# Om Gan Ganapataye Namah

# VoiceToFlow Product Plan

## Vision

Build a browser-based flowchart application like Lucidchart, focused on fast creation through direct editing and voice conversation. The core canvas will use React Flow, and users will be able to attach operational actions to nodes, such as WhatsApp messages, notes, reminders, and tasks.

The unique part of the product is that the user can talk to the flowchart. The AI assistant should create, update, explain, and organize the diagram while preserving structured flow data.

## Core Use Case

Example user intent:

> Create a sales follow-up flow. First collect lead details, then send Rahul a WhatsApp message, then wait for response, then schedule a demo.

The app should produce:

- Flowchart nodes and edges.
- A WhatsApp action attached to the relevant node.
- A note such as `@rahul to share @whatsapp message`.
- A task generated from that note and assigned to Rahul.

## MVP Scope

### Must Have

- Create, edit, move, connect, delete, and label flowchart nodes.
- Use React Flow custom nodes for business process steps.
- Add node details through a side panel.
- Add notes to any node.
- Parse notes into tasks when they contain assignees and action tags.
- Store flows, nodes, edges, notes, actions, and tasks.
- Use OpenAI Realtime API for voice conversation with the flowchart.
- Let AI create or update the diagram through controlled tool calls.
- Save and reload diagrams.

### Should Have

- Node action types:
  - WhatsApp message.
  - Manual task.
  - Wait/delay.
  - Condition/decision.
  - Webhook/API action.
- Task status tracking: `todo`, `in_progress`, `done`, `cancelled`.
- Basic version history for flows.
- Import/export JSON.
- Undo/redo for canvas edits.

### Later

- Real WhatsApp sending through Meta WhatsApp Cloud API or another approved provider.
- Team collaboration and comments.
- Multi-user live editing.
- Templates for sales, onboarding, support, hiring, and project workflows.
- Flow execution engine.
- Role-based access control.

## Suggested Tech Stack

### Frontend

- React with TypeScript.
- Vite for local development.
- `@xyflow/react` for the canvas.
- Tailwind CSS for UI styling.
- Zustand or Jotai for client state.
- React Hook Form for node/action editing forms.
- Zod for validation of AI tool payloads and API inputs.

React Flow is now published as `@xyflow/react`. Its docs describe flows as nodes, edges, and a viewport, and custom nodes can use handles for connection points.

### Backend

- Django.
- Django REST Framework for API endpoints.
- PostgreSQL for persistent data.
- Django ORM for schema and migrations.
- `django-cors-headers` for local frontend/backend development.
- Celery + Redis for background jobs such as future WhatsApp sending, reminders, retries, and long-running AI workflows.
- Django Channels later if we need backend WebSockets or collaborative editing.
- OpenAI Python SDK for Realtime session creation and structured AI commands.

### AI Layer

- Browser connects to OpenAI Realtime by WebRTC using an ephemeral token minted by our backend.
- Django keeps the real OpenAI API key private.
- AI changes the diagram only through explicit tools such as `create_node`, `update_node`, `connect_nodes`, `create_task`, and `attach_action_to_node`.
- Django validates every tool payload before applying it.

OpenAI docs recommend WebRTC for browser/client Realtime interactions, WebSocket for server-side Realtime connections, and ephemeral client secrets for browser sessions. They also recommend keeping tool use and business logic server-side when privacy and control matter.

## Product Model

### Flow

Represents one diagram.

Fields:

- `id`
- `name`
- `description`
- `owner_id`
- `created_at`
- `updated_at`

### Node

Represents a process step on the canvas.

Fields:

- `id`
- `flow_id`
- `type`
- `title`
- `description`
- `position_x`
- `position_y`
- `width`
- `height`
- `data`
- `created_at`
- `updated_at`

Initial node types:

- `start`
- `process`
- `decision`
- `message`
- `task`
- `wait`
- `end`

### Edge

Represents a connection between nodes.

Fields:

- `id`
- `flow_id`
- `source_node_id`
- `target_node_id`
- `source_handle`
- `target_handle`
- `label`
- `condition`
- `created_at`
- `updated_at`

### Note

User-written text attached to a node.

Fields:

- `id`
- `flow_id`
- `node_id`
- `body`
- `created_by`
- `created_at`

Example:

```text
@rahul to share @whatsapp message
```

### Task

Generated manually or from a note.

Fields:

- `id`
- `flow_id`
- `node_id`
- `note_id`
- `title`
- `assignee`
- `channel`
- `status`
- `due_at`
- `created_at`
- `updated_at`

Generated task example:

- `title`: Share WhatsApp message
- `assignee`: Rahul
- `channel`: WhatsApp
- `status`: todo

### Action

Structured action attached to a node.

Fields:

- `id`
- `flow_id`
- `node_id`
- `type`
- `config`
- `status`
- `created_at`
- `updated_at`

Action types:

- `whatsapp_message`
- `manual_task`
- `wait`
- `condition`
- `webhook`

WhatsApp action config:

```json
{
  "recipient": "@rahul",
  "message": "Please share the proposal with the customer.",
  "send_mode": "draft",
  "requires_approval": true
}
```

For MVP, WhatsApp actions should stay in draft/task mode. Actual sending should be a later integration because it needs provider setup, templates, consent, and audit trails.

## Note To Task Parsing

Start with deterministic parsing before using AI.

Rules:

- `@person` maps to assignee when it matches a known user/contact.
- `@whatsapp` maps to channel `whatsapp`.
- Verbs like `share`, `send`, `call`, `follow up`, `review`, `approve` become task intent.
- The remaining text becomes the task title.

Example:

Input:

```text
@rahul to share @whatsapp message
```

Output:

```json
{
  "assignee": "rahul",
  "channel": "whatsapp",
  "title": "Share WhatsApp message",
  "status": "todo"
}
```

If deterministic parsing is uncertain, call the AI to classify the note into a strict JSON schema and ask the user for confirmation before creating the task.

## AI Assistant Behavior

The assistant should behave like a flowchart co-pilot, not like a free-form chatbot.

Supported voice commands:

- "Create a lead qualification flow."
- "Add a WhatsApp message after the demo step."
- "Assign Rahul a task to send the customer reminder."
- "Connect payment received to onboarding."
- "Make this decision branch yes and no."
- "Summarize this flow."
- "Find tasks assigned to Rahul."
- "Clean up the layout."

AI should be able to call these app tools:

- `get_current_flow`
- `create_node`
- `update_node`
- `delete_node`
- `create_edge`
- `update_edge`
- `delete_edge`
- `attach_note`
- `create_task`
- `attach_action`
- `layout_flow`

Tool calls must return structured results and should be persisted only after backend validation.

## Realtime API Plan

### Browser Flow

- User clicks "Talk to Flow".
- Frontend requests `/api/realtime/session/` from Django.
- Django calls OpenAI to create a Realtime client secret.
- Frontend uses the ephemeral secret to start a WebRTC Realtime session.
- Audio streams directly between browser and OpenAI.
- Realtime data channel receives model events and tool call requests.

### Server Control Flow

- Django owns app tools and flow mutation.
- Tool calls that mutate state should be routed through Django REST endpoints.
- Use a server-side control path for sensitive business logic where possible.
- The frontend should never expose the OpenAI API key.

## API Endpoints

Initial REST endpoints:

- `POST /api/flows/`
- `GET /api/flows/`
- `GET /api/flows/:flowId/`
- `PATCH /api/flows/:flowId/`
- `DELETE /api/flows/:flowId/`
- `POST /api/flows/:flowId/nodes/`
- `PATCH /api/flows/:flowId/nodes/:nodeId/`
- `DELETE /api/flows/:flowId/nodes/:nodeId/`
- `POST /api/flows/:flowId/edges/`
- `PATCH /api/flows/:flowId/edges/:edgeId/`
- `DELETE /api/flows/:flowId/edges/:edgeId/`
- `POST /api/flows/:flowId/nodes/:nodeId/notes/`
- `POST /api/flows/:flowId/tasks/`
- `PATCH /api/flows/:flowId/tasks/:taskId/`
- `POST /api/flows/:flowId/actions/`
- `POST /api/realtime/session/`

## Frontend Screens

### Flow Dashboard

- List saved flows.
- Create a new flow.
- Open recent flows.

### Flow Editor

- Full-screen React Flow canvas.
- Left toolbar for adding node types.
- Right side panel for selected node details.
- Bottom or floating voice control for "Talk to Flow".
- Task drawer showing generated tasks.

### Task View

- Filter by assignee, status, channel, and flow.
- Open source node from each task.

## Build Phases

### Phase 1: Project Foundation

- Create React + TypeScript + Vite app.
- Create Django project and Django app modules.
- Add Django REST Framework.
- Add PostgreSQL settings.
- Add Django models and migrations.
- Add `django-cors-headers` for local frontend access.
- Add linting, formatting, and basic test setup.

Acceptance:

- App runs locally.
- Django health check works.
- Django migrations run.
- React frontend can call Django API locally.

### Phase 2: Flow Canvas MVP

- Install and configure `@xyflow/react`.
- Implement node and edge CRUD.
- Add custom node rendering.
- Add side panel editing.
- Persist flow state.

Acceptance:

- User can build and save a simple flowchart manually.

### Phase 3: Notes, Actions, And Tasks

- Add notes to nodes.
- Add action editor to nodes.
- Parse notes into tasks.
- Add task drawer.
- Store tasks and link them to source notes/nodes.

Acceptance:

- Typing `@rahul to share @whatsapp message` on a node creates a Rahul WhatsApp task.

### Phase 4: AI Text Commands

- Add text command box before voice.
- Implement backend AI tool schemas.
- Allow AI to create and update flows through tool calls.
- Validate every AI mutation.

Acceptance:

- User can type "create a customer onboarding flow" and get a structured diagram.

### Phase 5: Realtime Voice

- Add Django endpoint `/api/realtime/session/`.
- Add WebRTC Realtime client.
- Add voice UI.
- Connect Realtime tool calls to Django flow tools.

Acceptance:

- User can speak to create or modify a flowchart.

### Phase 6: WhatsApp Integration

- Choose provider: Meta WhatsApp Cloud API, Twilio, or another approved provider.
- Add contact mapping.
- Add message templates and approval step.
- Add send logs and failure handling.

Acceptance:

- A WhatsApp action can move from draft to approved to sent with audit history.

## Risks And Decisions

### Open Decisions

- Should MVP require user accounts, or start single-user local workspace first?
- Should tasks be internal only, or sync with an external tool like Linear, Jira, Asana, or Slack?
- Should WhatsApp start as draft-only, or should actual sending be included in v1?
- Should the AI auto-apply changes, or stage them for user approval first?

### Main Risks

- AI can create messy diagrams unless we constrain output to strict schemas.
- Realtime tool calls can mutate state too quickly without review or undo.
- WhatsApp sending has compliance, consent, template, and audit requirements.
- Collaborative editing adds complexity and should wait until the single-user editor is solid.

## Recommended First Implementation Order

1. Bootstrap the React app and Django backend.
2. Build manual React Flow editor.
3. Add Django models, serializers, viewsets, and PostgreSQL persistence.
4. Add notes and task generation.
5. Add text AI command mode.
6. Add Realtime voice.
7. Add Celery + Redis for background jobs.
8. Add real WhatsApp sending only after draft workflow is stable.

## References

- OpenAI Realtime API overview: https://developers.openai.com/api/docs/guides/realtime
- OpenAI Realtime WebRTC guide: https://developers.openai.com/api/docs/guides/realtime-webrtc
- OpenAI Realtime server-side controls: https://developers.openai.com/api/docs/guides/realtime-server-controls
- React Flow concepts: https://reactflow.dev/learn/concepts/core-concepts
- React Flow building a flow: https://reactflow.dev/learn/concepts/building-a-flow
