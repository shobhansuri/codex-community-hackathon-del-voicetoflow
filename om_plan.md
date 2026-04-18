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

- Left-side node palette.
- Main flowchart canvas area.
- Add nodes by clicking a palette item.
- Add nodes by dragging from the palette onto the canvas.
- Extend arrows from any node handle to create connections.
- Create, edit, move, connect, delete, and label flowchart nodes.
- Use React Flow custom nodes for business process steps.
- Add node details through a side panel.
- Add notes to any node.
- Add docs as full-page content objects that can stand alone or link to one or more nodes.
- Parse notes into tasks when they contain assignees and action tags.
- Store flows, nodes, edges, notes, docs, actions, and tasks.
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
- MySQL for persistent data.
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

## Core Architectural Rules

- Build a shared command layer first. Every canvas mutation should go through reusable commands such as `addNode`, `updateNode`, `connectNodes`, `addNote`, `attachAction`, and `layoutFlow`. Realtime voice must reuse that exact same command layer, not a separate mutation path.
- Design the MVP to be multi-user-ready even if the first release is single-user. Use workspace-aware ownership, creator/updater metadata, and revision-based conflict checks from the beginning so later collaboration does not require a data model rewrite.
- Give every flow object a stable ID from day one. Nodes, edges, notes, tasks, actions, and flows must have durable identifiers so the backend and AI can refer to them reliably across turns.
- Keep the flow state serializable as compact JSON. The canonical flow contract should be a clean structure of flow, nodes, edges, notes, tasks, and actions rather than ad hoc frontend-only state.
- Keep docs outside the canvas node body. Nodes may show doc count badges, but full document content should live in a dedicated doc editor so the canvas does not become a page editor.
- Keep Django as the source of truth for saved flows. React Flow and local client state can manage interaction, but all persisted mutations must be validated and saved through Django APIs.
- Separate domain state from transient UI state. Selection, hover, drag previews, and panel visibility should stay frontend-only, while flow data and mutations should stay in the domain model.
- Define strict tool and API schemas before adding voice. Manual UI, text AI, and Realtime voice should all operate through the same validated contracts with structured success and error responses.
- Plan for undo, review, and auditability from the beginning. AI-driven changes must be reversible, visible, and traceable.

OpenAI docs recommend WebRTC for browser/client Realtime interactions, WebSocket for server-side Realtime connections, and ephemeral client secrets for browser sessions. They also recommend keeping tool use and business logic server-side when privacy and control matter.

## Product Model

### Flow

Represents one diagram.

Fields:

- `id`
- `workspace_id`
- `name`
- `description`
- `created_by`
- `updated_by`
- `version`
- `created_at`
- `updated_at`

For MVP, the app can run with a single default workspace and one active user, but the schema should remain workspace-ready for later multi-user support.

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
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Initial node types:

- `start`
- `process`
- `decision`
- `message`
- `note`
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
- `created_by`
- `updated_by`
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
- `updated_by`
- `created_at`
- `updated_at`

Example:

```text
@rahul to share @whatsapp message
```

### Doc

A full-page content object for longer information, requirements, explanations, SOPs, meeting notes, or reference material.

Docs are separate from notes:

- A note is quick planning text attached to a node.
- A doc is a richer page that can be opened and edited on its own route.
- A doc may be linked to one node, many nodes, or no node.
- A doc should not be rendered inside the node body; nodes only show a compact doc badge/count.

Fields:

- `id`
- `flow_id`
- `title`
- `content`
- `summary`
- `linked_node_ids`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`

Recommended MVP content format:

- Store `content` as plain markdown or simple JSON text first.
- Use a textarea or markdown editor for MVP.
- Add rich block editing later only if users need it.

Relationships:

- `flow_id` is required because the doc belongs to a workflow.
- `linked_node_ids` is optional.
- A doc with no linked nodes appears only in the flow-level Docs view.
- A doc linked to a node appears in that node inspector under a Docs section.

Example:

```json
{
  "title": "Lead Qualification Notes",
  "summary": "Decision rules and sales team context for the qualification branch.",
  "linked_node_ids": ["node-qualification"],
  "content": "## Qualification rules\n\n- Ask budget.\n- Ask timeline.\n- Route enterprise leads to Rahul."
}
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
- `created_by`
- `updated_by`
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
- `created_by`
- `updated_by`
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

## Task Creation UX

Notes and tasks should stay separate but connected.

- Notes are the primary planning surface.
- Tasks are the structured execution surface.
- A task can be created from a note and should keep a `note_id` link.
- A task can also be created directly from the selected node with `+ Task`.
- The canvas node should stay lightweight and show count badges such as `Notes 2` and `Tasks 1`.
- Full note and task content should live in the right inspector and global task drawer.

MVP task creation should use one compact inline composer:

- Task title.
- Assignee.
- Due date.
- Channel: `general`, `whatsapp`, `call`, or `email`.
- Optional details behind a collapsed `More details` action.

Do not ask for status, dependencies, approval, reminders, or long structured fields during initial creation. Those fields can be edited later from the inspector or task drawer.

## Docs UX

Docs should be separate from notes and tasks, but connected to the workflow.

- Docs are for longer structured context.
- Notes are for quick planning thoughts.
- Tasks are for execution.
- A doc can be created from the top Docs tab, from a selected node, or later by AI.
- A doc may stay flow-level only, or be linked to one or more nodes.
- The canvas node should show a small doc icon/count when docs are linked.

Recommended MVP UI:

- Add a top-level `Docs` tab next to `Flowchart` and `Tasks`.
- The Docs tab shows a searchable list/table of all docs for the current flow.
- Each doc row shows title, linked nodes, updated time, and quick actions.
- Clicking a doc opens a full-page editor route such as `/flows/:flowId/docs/:docId`.
- The selected node inspector gets a compact `Docs` section with:
  - linked docs list
  - `+ Doc`
  - `Link existing doc`
- The node itself only shows a doc badge, not the doc content.

MVP doc editor:

- Title input.
- Large markdown/plain-text editor.
- Linked nodes selector.
- Save/autosave.
- Back to flow.

Avoid putting a full document editor directly inside the inspector. The inspector should only create, link, unlink, and preview docs.

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
- "Create a doc for this node with the sales qualification rules."
- "Link this document to the onboarding step."
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

## OpenAI Realtime Readiness Requirements

Design the manual editor so OpenAI Realtime can be added without rewriting the canvas.

### Command Layer

All diagram mutations should go through reusable commands. The UI should use these commands first; later, AI tool calls should use the same commands through Django APIs.

Build a command layer first. Every canvas mutation should go through reusable commands such as `addNode`, `updateNode`, `connectNodes`, `addNote`, `attachAction`, and `layoutFlow`. Realtime voice should reuse that exact same command layer, not a separate mutation path.

Required commands:

- `addNode`
- `updateNode`
- `deleteNode`
- `connectNodes`
- `updateEdge`
- `deleteEdge`
- `addNote`
- `create_doc`
- `update_doc`
- `link_doc_to_node`
- `unlink_doc_from_node`
- `createTask`
- `attachAction`
- `layoutFlow`

Do not let OpenAI directly mutate React Flow state. OpenAI should request structured tool calls, and the app should validate and apply them.

### Stable IDs

Every object should have a stable ID from the beginning:

- `flow_id`
- `node_id`
- `edge_id`
- `note_id`
- `task_id`
- `action_id`

The AI needs stable identifiers so it can refer to nodes and edges reliably across turns.

Example:

```text
node_lead_captured
node_send_whatsapp
edge_lead_to_whatsapp
```

### Serializable Flow State

The current flow must be serializable as compact JSON:

```json
{
  "flow": {
    "id": "flow_123",
    "name": "Sales follow-up"
  },
  "nodes": [],
  "edges": [],
  "tasks": []
}
```

Avoid storing important flow data only in frontend-only state. React Flow can manage interaction state, but Django and PostgreSQL should own the saved flow state.

### Backend As Source Of Truth

For saved flows, Django is canonical.

- React Flow owns immediate canvas interaction.
- Zustand owns local editor state.
- Django validates and persists flow changes.
- MySQL stores durable state.
- AI tools call Django APIs, not raw frontend state.

### Tool Schemas Before Voice

Implement AI tools before Realtime voice.

Initial tool contracts:

- `get_current_flow`
- `create_node`
- `update_node`
- `delete_node`
- `create_edge`
- `update_edge`
- `delete_edge`
- `add_note`
- `create_task`
- `attach_action`
- `layout_flow`

Each tool should have:

- Strict input schema.
- Django validation.
- Permission check when auth exists.
- Structured success/error response.
- Audit-friendly result.

### Realtime Session Security

The frontend must never receive the real OpenAI API key.

Flow:

- Frontend calls `POST /api/realtime/session/`.
- Django uses the server-side OpenAI API key to create an ephemeral Realtime client secret.
- Frontend uses the ephemeral secret to connect to OpenAI Realtime over WebRTC.
- Browser handles microphone input and audio output.
- Django handles persistence, validation, and sensitive business logic.

### Tool Call Routing

For the first Realtime implementation:

- Browser receives Realtime tool call events.
- Realtime may trigger structured graph-edit tool calls such as `create_node`, `update_node`, `create_edge`, `update_edge`, and `layout_flow`.
- Browser routes those mutation requests to Django REST APIs and the shared command layer.
- Django validates the requested graph changes, creates a draft update or pending proposal, and returns the updated draft flow.
- Frontend refreshes React Flow state from the API response so the user can see the proposed graph update immediately.
- Realtime must not directly mutate React Flow state as the source of truth and must not persist final changes without backend validation and user approval.

Later, add a server-side or sideband control path so Django can monitor the Realtime session and respond to tool calls directly.

### Context Strategy

Do not send unnecessary history to Realtime.

Send only:

- Current flow summary.
- Current nodes and edges.
- Selected node.
- Recent notes/tasks.
- Short tool instructions.

Avoid sending:

- Full edit history.
- Large audit logs.
- Old chat transcripts unless needed.

### Undo And Review

Realtime tool calls can mutate state quickly, so the editor should support at least one of:

- Undo/redo.
- Staged AI changes requiring user approval.
- Version snapshots.

For v1, prefer undo/redo plus visible change summaries.

### Development Order

Add AI in this order:

1. Manual canvas commands.
2. Django persistence.
3. Text AI command box.
4. Realtime voice using the same tool layer.

This makes debugging easier because text AI proves the schemas and mutations before voice is introduced.

## Realtime API Plan

### Browser Flow

- User clicks "Talk to Flow".
- Frontend requests `/api/realtime/session/` from Django.
- Django calls OpenAI to create a Realtime client secret.
- Frontend uses the ephemeral secret to start a WebRTC Realtime session.
- Audio streams directly between browser and OpenAI.
- Realtime data channel receives model events and tool call requests about what should change in the graph.
- Those tool call requests are converted into validated app commands rather than direct canvas mutations.

### Server Control Flow

- Django owns app tools and flow mutation.
- Tool calls that mutate state should be routed through Django REST endpoints.
- For MVP, Realtime-triggered graph edits should update a draft flow or pending proposal first and only persist as a saved version after approval.
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
- `GET /api/flows/:flowId/docs/`
- `POST /api/flows/:flowId/docs/`
- `GET /api/flows/:flowId/docs/:docId/`
- `PATCH /api/flows/:flowId/docs/:docId/`
- `DELETE /api/flows/:flowId/docs/:docId/`
- `POST /api/flows/:flowId/docs/:docId/links/`
- `DELETE /api/flows/:flowId/docs/:docId/links/:nodeId/`
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

- Two-panel workspace: left node palette, right/main React Flow canvas.
- Left toolbar for adding node types by click or drag.
- Canvas supports moving nodes, selecting nodes, zooming, panning, and connecting nodes.
- Each node exposes handles so users can extend arrows from any node.
- Right side panel for selected node details.
- Bottom or floating voice control for "Talk to Flow".
- Task drawer showing generated tasks.
- Top workspace tabs for Flowchart, Tasks, and Docs.

### Task View

- Filter by assignee, status, channel, and flow.
- Open source node from each task.

### Docs View

- List every doc in the current flow.
- Search docs by title and content.
- Filter docs by linked node.
- Create a new standalone doc.
- Open a doc in its own editor page.
- Jump from a doc to any linked node.

### Doc Editor

- Full-page editor for one doc.
- Edit title and body.
- Link or unlink nodes.
- Save changes and return to the flow.

## Build Phases

### Phase 1: Project Foundation

- Create React + TypeScript + Vite app.
- Create Django project and Django app modules.
- Add Django REST Framework.
- Add MySQL settings.
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
- Build left-side node palette.
- Support click-to-add nodes from the palette.
- Support drag-and-drop nodes from the palette onto the canvas.
- Add React Flow handles to every custom node.
- Support drawing arrows from node handles.
- Implement node and edge CRUD.
- Add custom node rendering.
- Add side panel editing.
- Persist flow state.

Acceptance:

- User sees node options on the left and the flowchart canvas on the right.
- User can click a node type to add it to the canvas.
- User can drag a node type onto the canvas.
- User can extend an arrow from any node to another node.
- User can build and save a simple flowchart manually.

#### Phase 2 Detailed React Flow Implementation Sequence

Recommended frontend file structure for this repo:

- `frontend/src/main.tsx`: add app-level providers and mount the editor app cleanly.
- `frontend/src/App.tsx`: replace the Vite starter screen with the editor shell.
- `frontend/src/features/flow/types.ts`: define typed flow, node, edge, note, task, and action contracts.
- `frontend/src/features/flow/store/flowStore.ts`: create the Zustand store for flow domain state and UI state.
- `frontend/src/features/flow/commands/flowCommands.ts`: implement the shared command layer for all mutations.
- `frontend/src/features/flow/components/FlowEditor.tsx`: compose the overall editor layout.
- `frontend/src/features/flow/components/FlowCanvas.tsx`: host the `ReactFlow` instance and wire its events.
- `frontend/src/features/flow/components/NodePalette.tsx`: render click-to-add and drag-to-add node options.
- `frontend/src/features/flow/components/NodeInspector.tsx`: edit the selected node and its details.
- `frontend/src/features/flow/nodes/*`: custom node components for `start`, `process`, `decision`, `message`, `task`, `wait`, and `end`.
- `frontend/src/features/flow/edges/*`: edge definitions and future custom edge rendering.
- `frontend/src/features/flow/validation/graphRules.ts`: define connection and graph validation rules.
- `frontend/src/features/flow/layout/layoutFlow.ts`: hold the auto-layout integration behind one module.
- `frontend/src/features/flow/persistence/serializeFlow.ts`: convert frontend state to the saved JSON contract and back.
- `frontend/src/features/flow/keyboard/shortcuts.ts`: centralize delete, duplicate, escape, and undo/redo shortcuts.
- `frontend/src/features/flow/devtools/flowDevtools.tsx`: wire React Flow DevTools in development only.

Detailed implementation checklist:

- Wrap the editor with `ReactFlowProvider` so side panels, toolbars, and future voice controls can access flow state without prop drilling.
- Replace the current starter page with a three-part editor shell: left palette, center canvas, right inspector, plus a fixed toolbar area for save, undo, and future voice controls.
- Use custom nodes for all business steps instead of relying on built-in node types.
- Give nodes explicit handle IDs from the beginning so decisions and branch-specific edges can be addressed reliably by the UI and later by AI tools.
- Keep Zustand state split between domain state and transient UI state. Domain state should include nodes, edges, viewport, selected IDs, dirty state, and revision metadata. UI state should include panel visibility, drag state, and modal state.
- Implement the shared command layer before wiring the full UI. Canvas events, palette actions, inspector edits, keyboard shortcuts, and later AI tool calls should all use the same mutation commands.
- Add `Background`, `Controls`, `MiniMap`, and `Panel` from the start so the editor is usable before advanced features are added.
- Use `NodeToolbar` for selection actions and `NodeResizer` only for nodes that truly need resize behavior such as notes, groups, or container-like nodes.
- Add graph validation early through `isValidConnection` and related rules. Prevent obviously invalid source-target combinations and reserve a place for cycle prevention and branching rules.
- Persist the viewport together with nodes and edges so reopening a flow returns the user to the same framing.
- Add keyboard behavior early: delete selected element, escape to clear selection, duplicate node, and reserve hooks for undo/redo.
- Keep edge labels and branch labels in the model even if the first visual treatment is simple.
- Hide layout engine choice behind one module. Start with `dagre` for a simple MVP and move to `elkjs` later only if the graph rules outgrow `dagre`.
- Use `react-hook-form` plus `zod` in the inspector so node editing and later AI tool validation follow the same shape rules.
- Serialize and restore flows through one compact JSON contract that matches the backend-facing model.
- Add React Flow DevTools during implementation to inspect node state, viewport state, and change logs while the editor is still being built.
- Avoid broad subscriptions to `nodes` and `edges` in random components. Derive small selectors for selection state, counts, and inspector data to avoid unnecessary re-renders during drag and zoom.

Phase 2 readiness checks before moving on:

- The editor no longer contains any starter-template UI.
- A user can add, move, connect, relabel, inspect, and delete nodes and edges.
- Invalid connections are blocked by frontend validation.
- The selected node can be edited from the inspector without breaking canvas interaction.
- The viewport, nodes, and edges can be saved and restored consistently.
- All mutations go through the shared command layer rather than ad hoc component state updates.
- The editor state is ready to be serialized and sent to Django without shape translation surprises.

### Phase 3: Notes, Docs, Actions, And Tasks

- Add notes to nodes.
- Add docs as flow-level pages.
- Link docs to nodes without making the link mandatory.
- Add Docs tab and full-page doc editor.
- Add action editor to nodes.
- Parse notes into tasks.
- Add task drawer.
- Store tasks and link them to source notes/nodes.
- Store docs and link them to nodes through an optional relationship.

Acceptance:

- Typing `@rahul to share @whatsapp message` on a node creates a Rahul WhatsApp task.
- User can create a standalone doc, open it in a full-page editor, and optionally link it to a node.

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
- Allow Realtime to trigger draft graph-edit commands for node, edge, and layout changes.
- Show proposed graph changes in the editor and require approval before saving a new version.

Acceptance:

- User can speak to propose graph changes, see the draft update in the canvas, and approve saving a new flow version.

### Phase 6: WhatsApp Integration

- Choose provider: Meta WhatsApp Cloud API, Twilio, or another approved provider.
- Add contact mapping.
- Add message templates and approval step.
- Add send logs and failure handling.

Acceptance:

- A WhatsApp action can move from draft to approved to sent with audit history.

## Risks And Decisions

### Open Decisions

- Should MVP require user accounts immediately, or start with a single-user default workspace while keeping the schema and APIs multi-user-ready?
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
3. Add Django models, serializers, viewsets, and MySQL persistence.
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
