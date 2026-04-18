from django.db import transaction
from django.db.models import Count
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Flow, FlowDoc, FlowEdge, FlowNode, Task
from .serializers import (
    FlowDetailSerializer,
    FlowListSerializer,
    TaskExtractionRequestSerializer,
    TaskExtractionResponseSerializer,
)
from .task_extraction import (
    TaskExtractionConfigError,
    TaskExtractionModelError,
    extract_note_tasks,
)
from .realtime import (
    RealtimeSessionConfigError,
    RealtimeSessionModelError,
    create_realtime_client_secret,
)


def health_check(_request):
    return JsonResponse({'status': 'ok', 'service': 'voicetoflow-api'})


class FlowListCreateView(APIView):
    def get(self, _request):
        flows = (
            Flow.objects.annotate(
                node_count=Count('nodes', distinct=True),
                edge_count=Count('edges', distinct=True),
            )
            .order_by('-updated_at')
        )
        serializer = FlowListSerializer(flows, many=True)
        return Response(serializer.data)

    def post(self, request):
        name = request.data.get('name') or 'Untitled flow'
        flow = Flow.objects.create(name=name)
        FlowNode.objects.create(
            flow=flow,
            node_id='node_start',
            kind=FlowNode.NodeKind.START,
            title='Start',
            description='',
            position_x=120,
            position_y=120,
        )

        serializer = FlowDetailSerializer(flow)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FlowDetailView(APIView):
    def get(self, _request, flow_uuid):
        flow = get_object_or_404(
            Flow.objects.prefetch_related(
                'nodes__notes',
                'edges',
                'docs',
                'tasks',
                'actions',
            ),
            uuid=flow_uuid,
        )
        serializer = FlowDetailSerializer(flow)
        return Response(serializer.data)

    @transaction.atomic
    def put(self, request, flow_uuid):
        flow = get_object_or_404(Flow, uuid=flow_uuid)
        flow.name = request.data.get('name') or flow.name
        flow.description = request.data.get('description') or ''
        flow.ai_context = request.data.get('aiContext') or ''
        settings = request.data.get('settings')
        flow.settings = settings if isinstance(settings, dict) else {}
        flow.save(
            update_fields=[
                'name',
                'description',
                'ai_context',
                'settings',
                'updated_at',
            ],
        )

        FlowEdge.objects.filter(flow=flow).delete()
        FlowDoc.objects.filter(flow=flow).delete()
        Task.objects.filter(flow=flow).delete()
        FlowNode.objects.filter(flow=flow).delete()
        node_by_client_id = {}
        note_by_client_id = {}

        for node_data in request.data.get('nodes', []):
            position = node_data.get('position') or {}
            node = FlowNode.objects.create(
                flow=flow,
                node_id=node_data['id'],
                kind=node_data.get('kind', FlowNode.NodeKind.PROCESS),
                title=node_data.get('title') or 'Untitled node',
                description=node_data.get('description') or '',
                position_x=position.get('x') or 0,
                position_y=position.get('y') or 0,
                data=node_data.get('data') or {},
            )
            node_by_client_id[node.node_id] = node
            for note_data in node_data.get('notes', []):
                body = (note_data.get('body') or '').strip()
                if body:
                    note = node.notes.create(flow=flow, body=body)
                    client_note_id = str(note_data.get('id') or '')
                    if client_note_id:
                        note_by_client_id[client_note_id] = note

        for edge_data in request.data.get('edges', []):
            source = edge_data.get('source')
            target = edge_data.get('target')
            if not source or not target:
                continue

            flow.edges.create(
                edge_id=edge_data['id'],
                source_node_id=source,
                target_node_id=target,
                source_handle=edge_data.get('sourceHandle') or '',
                target_handle=edge_data.get('targetHandle') or '',
                label=edge_data.get('label') or '',
                condition=edge_data.get('condition') or '',
            )

        for doc_data in request.data.get('docs', []):
            title = (doc_data.get('title') or '').strip()
            if not title:
                continue

            FlowDoc.objects.create(
                flow=flow,
                node=node_by_client_id.get(doc_data.get('nodeId') or ''),
                title=title,
                body=doc_data.get('body') or '',
            )

        valid_statuses = {choice[0] for choice in Task.Status.choices}
        for task_data in request.data.get('tasks', []):
            title = (task_data.get('title') or '').strip()
            if not title:
                continue

            status_value = task_data.get('status') or Task.Status.TODO
            if status_value not in valid_statuses:
                status_value = Task.Status.TODO

            node = node_by_client_id.get(task_data.get('nodeId') or '')
            note_id = str(
                task_data.get('noteId') or task_data.get('sourceNoteId') or '',
            )
            note = note_by_client_id.get(note_id)
            metadata = task_data.get('metadata') or {}
            due = (task_data.get('due') or '').strip()
            if due:
                metadata = {**metadata, 'due': due}

            Task.objects.create(
                flow=flow,
                node=node,
                note=note,
                title=title,
                description=task_data.get('description') or '',
                assignee=task_data.get('assignee') or '',
                channel=task_data.get('channel') or 'general',
                status=status_value,
                metadata=metadata,
            )

        serializer = FlowDetailSerializer(
            Flow.objects.prefetch_related(
                'nodes__notes',
                'edges',
                'docs',
                'tasks',
                'actions',
            ).get(pk=flow.pk),
        )
        return Response(serializer.data)


class NoteTaskExtractionView(APIView):
    def post(self, request, flow_uuid):
        flow = get_object_or_404(Flow, uuid=flow_uuid)
        serializer = TaskExtractionRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        try:
            suggestions = extract_note_tasks(
                flow_name=payload.get('flowName') or flow.name,
                flow_description=payload.get('flowDescription') or flow.description,
                flow_ai_context=payload.get('aiContext') or flow.ai_context,
                node_title=payload.get('nodeTitle') or '',
                node_kind=payload.get('nodeKind') or '',
                note_body=payload['noteBody'],
                all_notes=payload.get('allNotes') or [],
                existing_tasks=payload.get('existingTasks') or [],
            )
        except TaskExtractionConfigError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except TaskExtractionModelError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        response_serializer = TaskExtractionResponseSerializer(
            {'suggestions': suggestions},
        )
        return Response(response_serializer.data)


class FlowRealtimeSessionView(APIView):
    def post(self, _request, flow_uuid):
        flow = get_object_or_404(
            Flow.objects.prefetch_related('nodes', 'edges'),
            uuid=flow_uuid,
        )

        try:
            session = create_realtime_client_secret(flow)
        except RealtimeSessionConfigError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except RealtimeSessionModelError as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(session)
