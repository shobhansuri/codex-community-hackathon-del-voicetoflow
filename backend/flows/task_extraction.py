import json
import re
from typing import Any

from django.conf import settings
from openai import OpenAI

SUPPORTED_TASK_CHANNELS = {'general', 'whatsapp', 'call', 'email'}

TASK_EXTRACTION_SCHEMA = {
    'type': 'object',
    'properties': {
        'suggestions': {
            'type': 'array',
            'items': {
                'type': 'object',
                'properties': {
                    'title': {'type': 'string'},
                    'description': {'type': 'string'},
                    'assignee': {'type': 'string'},
                    'due': {'type': 'string'},
                    'channel': {
                        'type': 'string',
                        'enum': sorted(SUPPORTED_TASK_CHANNELS),
                    },
                },
                'required': [
                    'title',
                    'description',
                    'assignee',
                    'due',
                    'channel',
                ],
                'additionalProperties': False,
            },
        },
    },
    'required': ['suggestions'],
    'additionalProperties': False,
}


class TaskExtractionError(Exception):
    pass


class TaskExtractionConfigError(TaskExtractionError):
    pass


class TaskExtractionModelError(TaskExtractionError):
    pass


def _clean_text(value: Any) -> str:
    if not isinstance(value, str):
        return ''

    return value.strip()


def _normalize_channel(value: Any) -> str:
    channel = _clean_text(value).lower()
    if channel in SUPPORTED_TASK_CHANNELS:
        return channel

    return 'general'


def _normalize_due(value: Any) -> str:
    due = _clean_text(value)
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', due):
        return due

    return ''


def _normalize_task_text(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', ' ', value.strip().lower()).strip()


def _normalize_task_key(title: str, description: str = '') -> str:
    source = title or description
    return _normalize_task_text(source)


def _task_matcher(title: str, description: str = '') -> dict[str, Any]:
    normalized_title = _normalize_task_text(title)
    normalized_description = _normalize_task_text(description)
    combined = ' '.join(
        value
        for value in [normalized_title, normalized_description]
        if value
    ).strip()
    tokens = {token for token in combined.split() if len(token) > 1}

    return {
        'title': normalized_title,
        'description': normalized_description,
        'primary': normalized_title or normalized_description,
        'combined': combined,
        'tokens': tokens,
    }


def _texts_overlap(left: str, right: str) -> bool:
    if not left or not right:
        return False

    shorter, longer = sorted((left, right), key=len)
    return len(shorter) >= 12 and shorter in longer


def _tasks_look_same(left: dict[str, Any], right: dict[str, Any]) -> bool:
    if left['primary'] and left['primary'] == right['primary']:
        return True

    for left_text, right_text in [
        (left['combined'], right['combined']),
        (left['title'], right['title']),
        (left['description'], right['description']),
        (left['primary'], right['combined']),
        (left['combined'], right['primary']),
    ]:
        if _texts_overlap(left_text, right_text):
            return True

    left_tokens = left['tokens']
    right_tokens = right['tokens']
    if len(left_tokens) >= 3 and left_tokens <= right_tokens:
        return True
    if len(right_tokens) >= 3 and right_tokens <= left_tokens:
        return True

    return False


def normalize_extraction_suggestions(
    suggestions: list[dict[str, Any]] | None,
    existing_tasks: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    existing_matchers = [
        _task_matcher(
            _clean_text(task.get('title')),
            _clean_text(task.get('description')),
        )
        for task in existing_tasks or []
        if isinstance(task, dict)
    ]
    existing_matchers = [
        matcher
        for matcher in existing_matchers
        if matcher['primary']
    ]

    normalized_suggestions: list[dict[str, str]] = []
    seen_matchers = [*existing_matchers]

    for suggestion in suggestions or []:
        if not isinstance(suggestion, dict):
            continue

        title = _clean_text(suggestion.get('title'))
        description = _clean_text(suggestion.get('description'))
        matcher = _task_matcher(title, description)

        if (
            not title
            or not matcher['primary']
            or any(_tasks_look_same(matcher, existing) for existing in seen_matchers)
        ):
            continue

        seen_matchers.append(matcher)
        normalized_suggestions.append(
            {
                'title': title,
                'description': description,
                'assignee': _clean_text(suggestion.get('assignee')),
                'due': _normalize_due(suggestion.get('due')),
                'channel': _normalize_channel(suggestion.get('channel')),
            },
        )

    return normalized_suggestions


def _get_refusal_message(response: Any) -> str:
    output = getattr(response, 'output', None) or []
    if not output:
        return ''

    content = getattr(output[0], 'content', None) or []
    if not content:
        return ''

    first_item = content[0]
    if getattr(first_item, 'type', '') == 'refusal':
        return _clean_text(getattr(first_item, 'refusal', ''))

    return ''


def extract_note_tasks(
    *,
    flow_name: str,
    flow_description: str,
    flow_ai_context: str,
    node_title: str,
    node_kind: str,
    note_body: str,
    all_notes: list[str] | None,
    existing_tasks: list[dict[str, Any]] | None,
) -> list[dict[str, str]]:
    api_key = _clean_text(getattr(settings, 'OPENAI_API_KEY', ''))
    if not api_key:
        raise TaskExtractionConfigError(
            'OpenAI task extraction is not configured. Set OPENAI_API_KEY.',
        )

    context = {
        'flow': {
            'name': _clean_text(flow_name),
            'description': _clean_text(flow_description),
            'aiContext': _clean_text(flow_ai_context),
        },
        'node': {
            'title': _clean_text(node_title),
            'kind': _clean_text(node_kind),
        },
        'note': {
            'body': _clean_text(note_body),
        },
        'all_notes': [
            cleaned_note
            for note in all_notes or []
            if (cleaned_note := _clean_text(note))
        ],
        'existing_tasks': [
            {
                'title': _clean_text(task.get('title')),
                'description': _clean_text(task.get('description')),
                'assignee': _clean_text(task.get('assignee')),
                'due': _normalize_due(task.get('due')),
                'channel': _normalize_channel(task.get('channel')),
                'status': _clean_text(task.get('status')),
            }
            for task in existing_tasks or []
            if isinstance(task, dict)
        ],
    }

    client = OpenAI(api_key=api_key)
    try:
        response = client.responses.create(
            model=getattr(
                settings,
                'FLOW_TASK_EXTRACTION_MODEL',
                'gpt-4o-mini',
            ),
            input=[
                {
                    'role': 'system',
                    'content': (
                        'Extract only missing actionable tasks from this node'
                        ' context. Treat the node title as note-like context,'
                        ' and use the current note together with all sibling'
                        ' notes for context. Existing tasks may already have'
                        ' been edited by the user, so do not repeat them or'
                        ' lightly reword them. Return only concrete work items'
                        ' that are not already present. Skip commentary, status'
                        ' updates, and context-only text. Keep titles short and'
                        ' actionable. Use flow.aiContext for people, roles,'
                        ' ownership, channel, naming, and assignment rules. If'
                        ' the context clearly maps the work to a person, set'
                        ' assignee. Leave assignee and due blank when unknown.'
                    ),
                },
                {
                    'role': 'user',
                    'content': json.dumps(context),
                },
            ],
            text={
                'format': {
                    'type': 'json_schema',
                    'name': 'task_extraction',
                    'schema': TASK_EXTRACTION_SCHEMA,
                    'strict': True,
                },
            },
        )
    except Exception as exc:
        raise TaskExtractionModelError(
            'Task extraction failed while calling OpenAI.',
        ) from exc

    if getattr(response, 'status', None) == 'incomplete':
        raise TaskExtractionModelError(
            'Task extraction did not complete. Try again.',
        )

    refusal_message = _get_refusal_message(response)
    if refusal_message:
        raise TaskExtractionModelError(refusal_message)

    output_text = _clean_text(getattr(response, 'output_text', ''))
    if not output_text:
        raise TaskExtractionModelError(
            'Task extraction returned no structured content.',
        )

    try:
        payload = json.loads(output_text)
    except json.JSONDecodeError as exc:
        raise TaskExtractionModelError(
            'Task extraction returned invalid structured content.',
        ) from exc

    return normalize_extraction_suggestions(
        payload.get('suggestions') if isinstance(payload, dict) else [],
        existing_tasks,
    )
