# VoiceToFlow

VoiceToFlow is a flowchart planning app that turns process diagrams into executable work. Users can build Lucidchart-style flows on a React Flow canvas, attach notes, docs, and tasks to nodes, and use voice to ask an OpenAI Realtime assistant to update the flow.

The product is designed around a simple planning loop:

- create flowchart nodes and connect them visually
- capture messy planning thoughts as notes
- convert actionable notes into structured tasks
- keep longer context in doc modals
- use voice commands to add, move, connect, disconnect, and label nodes
- use flow-level AI context to guide assignments, roles, channels, and task ownership

## Current Features

- React Flow canvas with start, process, decision, message, sticky note, task, wait, and end nodes
- Drag-and-drop node creation from a compact shape rail
- Manual line drawing with a quick menu to create the next connected node
- Decision branch labeling with YES and NO paths
- Notes and tasks kept separate but linked through source notes and nodes
- Global task table for all tasks in the flow
- Doc modals that can be standalone or attached to a node
- Flow-level AI context for people, roles, assignment rules, and project background
- OpenAI Realtime voice mode for editing the flow by speaking
- Voice tools for creating, updating, moving, connecting, and disconnecting flow nodes
- Autosave to a Django + MySQL backend

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, React Flow, Zustand, TanStack Query
- Backend: Django, Django REST Framework, MySQL
- AI: OpenAI Realtime API for voice-driven flow editing and OpenAI Responses API for task extraction

## Local Development

Backend:

```bash
../venv/bin/python backend/manage.py migrate
../venv/bin/python backend/manage.py runserver 127.0.0.1:8000
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Create `backend/.env` from `backend/.env.example` and add the local database and OpenAI settings.

## Project Status

This is an MVP. The core flow builder, task layer, docs, persistence, and voice assistant are working. Next useful areas are collaboration, stronger task assignment rules, better edge editing, and safer AI-assisted cleanup actions.
