import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.conf import settings

from .models import Flow

REALTIME_CLIENT_SECRET_URL = 'https://api.openai.com/v1/realtime/client_secrets'


class RealtimeSessionError(Exception):
    pass


class RealtimeSessionConfigError(RealtimeSessionError):
    pass


class RealtimeSessionModelError(RealtimeSessionError):
    pass


def _clean_text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ''


def _string_schema(description: str, *, enum: list[str] | None = None) -> dict[str, Any]:
    schema: dict[str, Any] = {'type': 'string', 'description': description}
    if enum:
        schema['enum'] = enum
    return schema


def _tool(
    name: str,
    description: str,
    properties: dict[str, Any],
    required: list[str],
) -> dict[str, Any]:
    return {
        'type': 'function',
        'name': name,
        'description': description,
        'parameters': {
            'type': 'object',
            'properties': properties,
            'required': required,
            'additionalProperties': False,
        },
    }


REALTIME_TOOLS = [
    _tool(
        'create_node',
        'Create a new flowchart node.',
        {
            'kind': _string_schema(
                'The node shape/type.',
                enum=[
                    'start',
                    'process',
                    'decision',
                    'message',
                    'note',
                    'task',
                    'wait',
                    'end',
                ],
            ),
            'title': _string_schema('Short visible node title.'),
            'description': _string_schema('Optional node description.'),
            'afterNodeId': _string_schema(
                'Optional existing node ID to connect from after creation.',
            ),
            'x': {'type': 'number', 'description': 'Optional canvas x position.'},
            'y': {'type': 'number', 'description': 'Optional canvas y position.'},
        },
        ['kind', 'title'],
    ),
    _tool(
        'update_node',
        'Update an existing node title, description, or kind.',
        {
            'nodeId': _string_schema('Existing node ID.'),
            'title': _string_schema('New title, or blank to keep current.'),
            'description': _string_schema('New description, or blank to keep current.'),
            'kind': _string_schema(
                'New node kind, or blank to keep current.',
                enum=[
                    '',
                    'start',
                    'process',
                    'decision',
                    'message',
                    'note',
                    'task',
                    'wait',
                    'end',
                ],
            ),
        },
        ['nodeId'],
    ),
    _tool(
        'connect_nodes',
        'Connect two existing flowchart nodes.',
        {
            'sourceNodeId': _string_schema('Existing source node ID.'),
            'targetNodeId': _string_schema('Existing target node ID.'),
            'label': _string_schema('Optional edge label.'),
        },
        ['sourceNodeId', 'targetNodeId'],
    ),
    _tool(
        'move_node',
        'Move an existing node to a new canvas position.',
        {
            'nodeId': _string_schema('Existing node ID.'),
            'x': {'type': 'number', 'description': 'New canvas x position.'},
            'y': {'type': 'number', 'description': 'New canvas y position.'},
        },
        ['nodeId', 'x', 'y'],
    ),
    _tool(
        'add_note',
        'Add a planning note to an existing node.',
        {
            'nodeId': _string_schema('Existing node ID.'),
            'text': _string_schema('Note text to add.'),
        },
        ['text'],
    ),
    _tool(
        'fetch_all_notes',
        'Fetch all current notes, optionally filtered to one node, before editing or summarizing notes.',
        {
            'nodeId': _string_schema(
                'Optional existing node ID. Leave blank to fetch notes from all nodes.',
            ),
        },
        [],
    ),
    _tool(
        'update_note',
        'Update the text of an existing note.',
        {
            'nodeId': _string_schema('Existing node ID that contains the note.'),
            'noteId': _string_schema('Existing note ID to update.'),
            'text': _string_schema('Replacement note text.'),
        },
        ['nodeId', 'noteId', 'text'],
    ),
    _tool(
        'create_task',
        'Create a structured task linked to an existing node.',
        {
            'nodeId': _string_schema('Existing node ID.'),
            'title': _string_schema('Task title.'),
            'assignee': _string_schema('Assignee name, or blank if unknown.'),
            'due': _string_schema('Due date or due text, or blank if unknown.'),
            'channel': _string_schema(
                'Task channel.',
                enum=['general', 'whatsapp', 'call', 'email'],
            ),
            'details': _string_schema('Optional task details.'),
        },
        ['title'],
    ),
    _tool(
        'create_doc',
        'Create a doc modal, optionally linked to a node.',
        {
            'nodeId': _string_schema('Existing node ID, or blank for flow-level doc.'),
            'title': _string_schema('Doc title.'),
            'body': _string_schema('Doc body.'),
        },
        ['title'],
    ),
    _tool(
        'rename_flow',
        'Rename the current flow.',
        {
            'name': _string_schema('New flow name.'),
        },
        ['name'],
    ),
    _tool(
        'set_line_mode',
        'Change the flowchart edge style.',
        {
            'mode': _string_schema('Line mode.', enum=['curved', 'straight']),
        },
        ['mode'],
    ),
]


def build_flow_context(flow: Flow) -> dict[str, Any]:
    nodes = list(flow.nodes.all().order_by('created_at'))
    edges = list(flow.edges.all().order_by('created_at'))

    return {
        'flow': {
            'id': str(flow.uuid),
            'name': flow.name,
            'description': flow.description,
            'aiContext': flow.ai_context,
            'settings': flow.settings or {},
        },
        'nodes': [
            {
                'id': node.node_id,
                'kind': node.kind,
                'title': node.title,
                'description': node.description,
                'position': {
                    'x': node.position_x,
                    'y': node.position_y,
                },
            }
            for node in nodes
        ],
        'edges': [
            {
                'id': edge.edge_id,
                'source': edge.source_node_id,
                'target': edge.target_node_id,
                'label': edge.label,
            }
            for edge in edges
        ],
    }


def build_realtime_instructions(flow: Flow) -> str:
    context = build_flow_context(flow)
    return (
        'You are VoiceToFlow, a voice assistant for editing a React Flow'
        ' flowchart. Convert the user speech into small tool calls. Use the'
        ' provided node IDs when editing existing nodes. If the target node is'
        ' ambiguous, ask one short clarification instead of guessing. Do not'
        ' invent assignees, due dates, or node names. Use the flow-level'
        ' aiContext for people, role, ownership, channel, naming, and assignment'
        ' rules. If aiContext clearly maps a type of work to a person, assign'
        ' the matching task to that person. Prefer process nodes for'
        ' normal steps and decision nodes only for branches. Use add_note for'
        ' planning thoughts, create_task for execution work, and create_doc for'
        ' longer independent page-like content. Use move_node when the user asks'
        ' to reorder, arrange, or move items on the canvas. Use fetch_all_notes'
        ' before editing notes if the needed note ID or text is not already in'
        ' context. When creating the next step after a visible or selected node,'
        ' pass that node ID as afterNodeId so the new node is placed directly'
        ' below and connected. When afterNodeId is provided, omit x and y unless'
        ' the user explicitly asks for a manual canvas position; the client will'
        ' calculate height-aware placement. Whenever you create a node that'
        ' represents work to be done, also create a matching task linked to that'
        ' new node. Use the node title as the task title, and leave assignee and'
        ' due blank unless the user clearly specified them. Do not call'
        ' destructive tools.'
        ' Current flow context JSON: '
        f'{json.dumps(context, separators=(",", ":"))}'
    )


def _extract_client_secret(payload: dict[str, Any]) -> tuple[str, int | None]:
    client_secret = payload.get('client_secret')
    expires_at = payload.get('expires_at')

    if isinstance(client_secret, dict):
        value = _clean_text(client_secret.get('value'))
        expires_at = client_secret.get('expires_at') or expires_at
    else:
        value = _clean_text(payload.get('value') or client_secret)

    session = payload.get('session')
    if not value and isinstance(session, dict):
        session_secret = session.get('client_secret')
        if isinstance(session_secret, dict):
            value = _clean_text(session_secret.get('value'))
            expires_at = session_secret.get('expires_at') or expires_at

    if isinstance(expires_at, str) and expires_at.isdigit():
        expires_at = int(expires_at)

    return value, expires_at if isinstance(expires_at, int) else None


def create_realtime_client_secret(flow: Flow) -> dict[str, Any]:
    api_key = _clean_text(getattr(settings, 'OPENAI_API_KEY', ''))
    if not api_key:
        raise RealtimeSessionConfigError(
            'OpenAI Realtime is not configured. Set OPENAI_API_KEY.',
        )

    model = _clean_text(getattr(settings, 'FLOW_REALTIME_MODEL', '')) or 'gpt-realtime-1.5'
    voice = _clean_text(getattr(settings, 'FLOW_REALTIME_VOICE', '')) or 'marin'
    transcription_model = (
        _clean_text(getattr(settings, 'FLOW_REALTIME_TRANSCRIPTION_MODEL', ''))
        or 'gpt-4o-mini-transcribe'
    )
    body = {
        'session': {
            'type': 'realtime',
            'model': model,
            'instructions': build_realtime_instructions(flow),
            'audio': {
                'input': {
                    'transcription': {
                        'model': transcription_model,
                    },
                },
                'output': {
                    'voice': voice,
                },
            },
            'tools': REALTIME_TOOLS,
            'tool_choice': 'auto',
        },
    }
    request = Request(
        REALTIME_CLIENT_SECRET_URL,
        data=json.dumps(body).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        },
        method='POST',
    )

    try:
        with urlopen(request, timeout=20) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except HTTPError as exc:
        detail = 'OpenAI Realtime rejected the session request.'
        try:
            error_payload = json.loads(exc.read().decode('utf-8'))
            message = error_payload.get('error', {}).get('message')
            if isinstance(message, str) and message.strip():
                detail = message.strip()
        except Exception:
            pass
        raise RealtimeSessionModelError(detail) from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise RealtimeSessionModelError(
            'OpenAI Realtime session creation failed.',
        ) from exc

    if not isinstance(payload, dict):
        raise RealtimeSessionModelError(
            'OpenAI Realtime returned an invalid session response.',
        )

    value, expires_at = _extract_client_secret(payload)
    if not value:
        raise RealtimeSessionModelError(
            'OpenAI Realtime returned no client secret.',
        )

    return {
        'clientSecret': value,
        'expiresAt': expires_at,
        'model': model,
    }
