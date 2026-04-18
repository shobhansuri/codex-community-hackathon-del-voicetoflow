import json
from datetime import timedelta
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from .models import Flow, FlowEdge, FlowNode
from .realtime import RealtimeSessionConfigError
from .task_extraction import (
    TaskExtractionConfigError,
    normalize_extraction_suggestions,
)


class FlowListCreateViewTests(TestCase):
    def test_get_returns_recent_flows_with_counts(self):
        older_flow = Flow.objects.create(name='Onboarding')
        FlowNode.objects.create(
            flow=older_flow,
            node_id='start',
            kind=FlowNode.NodeKind.START,
            title='Start',
            description='',
            position_x=120,
            position_y=120,
        )
        FlowNode.objects.create(
            flow=older_flow,
            node_id='step_1',
            kind=FlowNode.NodeKind.PROCESS,
            title='Collect details',
            description='',
            position_x=320,
            position_y=120,
        )
        FlowEdge.objects.create(
            flow=older_flow,
            edge_id='edge_start_step_1',
            source_node_id='start',
            target_node_id='step_1',
        )
        Flow.objects.filter(pk=older_flow.pk).update(
            updated_at=timezone.now() - timedelta(days=1),
        )

        recent_flow = Flow.objects.create(name='Support triage')
        FlowNode.objects.create(
            flow=recent_flow,
            node_id='start',
            kind=FlowNode.NodeKind.START,
            title='Start',
            description='',
            position_x=120,
            position_y=120,
        )

        response = self.client.get('/api/flows/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 2)
        self.assertEqual(response.json()[0]['name'], 'Support triage')
        self.assertEqual(response.json()[0]['nodeCount'], 1)
        self.assertEqual(response.json()[0]['edgeCount'], 0)
        self.assertEqual(response.json()[1]['name'], 'Onboarding')
        self.assertEqual(response.json()[1]['nodeCount'], 2)
        self.assertEqual(response.json()[1]['edgeCount'], 1)
        self.assertIn('updatedAt', response.json()[0])

    def test_post_creates_a_flow_with_default_start_node(self):
        response = self.client.post(
            '/api/flows/',
            data=json.dumps({'name': 'New blank flow'}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['name'], 'New blank flow')
        self.assertEqual(len(response.json()['nodes']), 1)
        self.assertEqual(response.json()['nodes'][0]['id'], 'node_start')


class NoteTaskExtractionViewTests(TestCase):
    def setUp(self):
        self.flow = Flow.objects.create(
            name='Customer onboarding',
            description='Turn notes into clear follow-up work.',
            ai_context='Ava owns customer calls. Mina owns email.',
        )

    @patch('flows.views.extract_note_tasks')
    def test_post_returns_draft_suggestions(self, extract_note_tasks_mock):
        extract_note_tasks_mock.return_value = [
            {
                'title': 'Call customer',
                'description': 'Confirm the onboarding date and required documents.',
                'assignee': 'Ava',
                'due': '2026-04-20',
                'channel': 'call',
            },
        ]

        response = self.client.post(
            f'/api/flows/{self.flow.uuid}/notes/extract-tasks/',
            data=json.dumps(
                {
                    'allNotes': [
                        'Call the customer tomorrow and confirm docs.',
                        'Send the onboarding deck after the call.',
                    ],
                    'nodeId': 'node_contact',
                    'nodeTitle': 'Contact customer',
                    'nodeKind': 'message',
                    'noteId': 'note_follow_up',
                    'noteBody': 'Call the customer tomorrow and confirm docs.',
                    'flowName': 'Customer onboarding',
                    'flowDescription': 'Turn notes into clear follow-up work.',
                    'aiContext': 'Ava owns customer calls. Mina owns email.',
                    'existingTasks': [
                        {
                            'title': 'Send welcome email',
                            'description': 'Include the prep checklist.',
                            'assignee': 'Mina',
                            'due': '2026-04-19',
                            'channel': 'email',
                            'status': 'todo',
                        },
                    ],
                },
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'suggestions': [
                    {
                        'title': 'Call customer',
                        'description': 'Confirm the onboarding date and required documents.',
                        'assignee': 'Ava',
                        'due': '2026-04-20',
                        'channel': 'call',
                    },
                ],
            },
        )
        extract_note_tasks_mock.assert_called_once_with(
            flow_name='Customer onboarding',
            flow_description='Turn notes into clear follow-up work.',
            flow_ai_context='Ava owns customer calls. Mina owns email.',
            node_title='Contact customer',
            node_kind='message',
            note_body='Call the customer tomorrow and confirm docs.',
            all_notes=[
                'Call the customer tomorrow and confirm docs.',
                'Send the onboarding deck after the call.',
            ],
            existing_tasks=[
                {
                    'title': 'Send welcome email',
                    'description': 'Include the prep checklist.',
                    'assignee': 'Mina',
                    'due': '2026-04-19',
                    'channel': 'email',
                    'status': 'todo',
                },
            ],
        )

    @patch(
        'flows.views.extract_note_tasks',
        side_effect=TaskExtractionConfigError(
            'OpenAI task extraction is not configured. Set OPENAI_API_KEY.',
        ),
    )
    def test_post_returns_503_when_openai_is_not_configured(self, _mock):
        response = self.client.post(
            f'/api/flows/{self.flow.uuid}/notes/extract-tasks/',
            data=json.dumps(
                {
                    'nodeId': 'node_contact',
                    'noteId': 'note_follow_up',
                    'noteBody': 'Call the customer tomorrow.',
                },
            ),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()['detail'],
            'OpenAI task extraction is not configured. Set OPENAI_API_KEY.',
        )


class FlowRealtimeSessionViewTests(TestCase):
    def setUp(self):
        self.flow = Flow.objects.create(name='Voice flow')

    @patch('flows.views.create_realtime_client_secret')
    def test_post_returns_ephemeral_client_secret(self, create_session_mock):
        create_session_mock.return_value = {
            'clientSecret': 'eph_secret',
            'expiresAt': 1760000000,
            'model': 'gpt-realtime-1.5',
        }

        response = self.client.post(
            f'/api/flows/{self.flow.uuid}/realtime/session/',
            data=json.dumps({}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                'clientSecret': 'eph_secret',
                'expiresAt': 1760000000,
                'model': 'gpt-realtime-1.5',
            },
        )
        create_session_mock.assert_called_once()

    @patch(
        'flows.views.create_realtime_client_secret',
        side_effect=RealtimeSessionConfigError(
            'OpenAI Realtime is not configured. Set OPENAI_API_KEY.',
        ),
    )
    def test_post_returns_503_when_openai_key_missing(self, _mock):
        response = self.client.post(
            f'/api/flows/{self.flow.uuid}/realtime/session/',
            data=json.dumps({}),
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()['detail'],
            'OpenAI Realtime is not configured. Set OPENAI_API_KEY.',
        )


class TaskExtractionNormalizationTests(SimpleTestCase):
    def test_normalize_extraction_suggestions_drops_duplicates_and_bad_values(self):
        normalized = normalize_extraction_suggestions(
            [
                {
                    'title': 'Call customer',
                    'description': 'Confirm the onboarding date.',
                    'assignee': 'Ava',
                    'due': '2026-04-20',
                    'channel': 'call',
                },
                {
                    'title': 'Call customer',
                    'description': 'Repeat the same work item.',
                    'assignee': '',
                    'due': '2026-04-21',
                    'channel': 'general',
                },
                {
                    'title': 'Send follow-up email',
                    'description': 'Share the checklist.',
                    'assignee': 'Mina',
                    'due': 'tomorrow morning',
                    'channel': 'fax',
                },
                {
                    'title': '   ',
                    'description': 'Ignore blank titles.',
                    'assignee': '',
                    'due': '',
                    'channel': 'general',
                },
            ],
            [
                {
                    'title': 'Call customer',
                    'description': 'Edited by the user already.',
                    'assignee': 'Ava',
                    'due': '2026-04-20',
                    'channel': 'call',
                    'status': 'todo',
                },
            ],
        )

        self.assertEqual(
            normalized,
            [
                {
                    'title': 'Send follow-up email',
                    'description': 'Share the checklist.',
                    'assignee': 'Mina',
                    'due': '',
                    'channel': 'general',
                },
            ],
        )

    def test_normalize_extraction_suggestions_drops_light_rewordings_of_existing_tasks(self):
        normalized = normalize_extraction_suggestions(
            [
                {
                    'title': 'Pray to Ganeshji',
                    'description': '',
                    'assignee': 'Shobhan',
                    'due': '',
                    'channel': 'general',
                },
                {
                    'title': 'Call customer',
                    'description': 'Confirm the next step.',
                    'assignee': '',
                    'due': '',
                    'channel': 'call',
                },
            ],
            [
                {
                    'title': 'Ask Shobhan to pray to Ganeshji',
                    'description': '',
                    'assignee': 'Shobhan',
                    'due': '',
                    'channel': 'general',
                    'status': 'todo',
                },
            ],
        )

        self.assertEqual(
            normalized,
            [
                {
                    'title': 'Call customer',
                    'description': 'Confirm the next step.',
                    'assignee': '',
                    'due': '',
                    'channel': 'call',
                },
            ],
        )
