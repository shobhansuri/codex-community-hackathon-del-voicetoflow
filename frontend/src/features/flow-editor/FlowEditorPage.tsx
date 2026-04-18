import { ReactFlowProvider } from '@xyflow/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DocsWorkspace } from './docs/DocsWorkspace'
import { getFlow, saveFlow } from './api/flowApi'
import type { FlowDocument } from './canvas/flowTypes'
import { FlowCanvas } from './canvas/FlowCanvas'
import { NodePalette } from './palette/NodePalette'
import { VoiceConversationPanel } from './realtime/VoiceConversationPanel'
import { useRealtimeFlow } from './realtime/useRealtimeFlow'
import { NodeDetailsPanel } from './side-panel/NodeDetailsPanel'
import { useFlowEditorStore } from './state/flowEditorStore'
import { WorkflowTasksTable } from './tasks/WorkflowTasksTable'

type WorkspaceTab = 'flowchart' | 'tasks' | 'docs'

function getFlowSignature(flow: FlowDocument) {
  return JSON.stringify({
    aiContext: flow.aiContext,
    description: flow.description,
    settings: flow.settings,
    edges: flow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
      label: typeof edge.label === 'string' ? edge.label : '',
    })),
    docs: flow.docs.map((doc) => ({
      body: doc.body,
      id: doc.id,
      nodeId: doc.nodeId,
      title: doc.title,
      updatedAt: doc.updatedAt,
    })),
    id: flow.id,
    name: flow.name,
    nodes: flow.nodes.map((node) => ({
      data: {
        description: node.data.description,
        kind: node.data.kind,
        notes: node.data.notes.map((note) => ({
          body: note.body,
          id: note.id,
        })),
        title: node.data.title,
      },
      id: node.id,
      position: node.position,
      type: node.type,
    })),
    tasks: flow.tasks.map((task) => ({
      assignee: task.assignee,
      channel: task.channel,
      details: task.details,
      due: task.due,
      id: task.id,
      nodeId: task.nodeId,
      sourceNoteId: task.sourceNoteId,
      status: task.status,
      title: task.title,
    })),
  })
}

function WorkspaceTabButton({
  active,
  children,
  count,
  onClick,
}: {
  active: boolean
  children: string
  count?: number
  onClick: () => void
}) {
  return (
    <button
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
        active
          ? 'bg-white text-zinc-950 shadow-[0_18px_30px_-26px_rgba(24,24,27,0.45)] ring-1 ring-zinc-950/8'
          : 'text-zinc-500 hover:bg-white hover:text-zinc-950'
      }`}
      onClick={onClick}
      type="button"
    >
      <div>{children}</div>
      {typeof count === 'number' ? (
        <p
          className={`rounded-full px-1.5 py-0.5 text-[0.72rem] font-semibold tabular-nums ${
            active
              ? 'bg-zinc-100 text-zinc-700'
              : 'bg-zinc-100/80 text-zinc-500'
          }`}
        >
          {count}
        </p>
      ) : null}
    </button>
  )
}

export function FlowEditorPage() {
  const { flowId } = useParams()
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<WorkspaceTab>('flowchart')
  const [contextOpen, setContextOpen] = useState(false)
  const [viewMenuOpen, setViewMenuOpen] = useState(false)
  const [flowNameDraft, setFlowNameDraft] = useState('')
  const aiContext = useFlowEditorStore((state) => state.aiContext)
  const edges = useFlowEditorStore((state) => state.edges)
  const flowDescription = useFlowEditorStore((state) => state.flowDescription)
  const flowName = useFlowEditorStore((state) => state.flowName)
  const settings = useFlowEditorStore((state) => state.settings)
  const nodes = useFlowEditorStore((state) => state.nodes)
  const docs = useFlowEditorStore((state) => state.docs)
  const tasks = useFlowEditorStore((state) => state.tasks)
  const loadFlow = useFlowEditorStore((state) => state.loadFlow)
  const setAiContext = useFlowEditorStore((state) => state.setAiContext)
  const setEdgeLineMode = useFlowEditorStore((state) => state.setEdgeLineMode)
  const setFlowDescription = useFlowEditorStore(
    (state) => state.setFlowDescription,
  )
  const setFlowName = useFlowEditorStore((state) => state.setFlowName)
  const realtime = useRealtimeFlow(flowId ?? '')
  const lastSavedSignatureRef = useRef<string | null>(null)
  const hasLoadedFlowRef = useRef(false)
  const flowQuery = useQuery({
    queryKey: ['flow', flowId],
    queryFn: () => getFlow(flowId!),
    enabled: Boolean(flowId),
  })

  useEffect(() => {
    if (flowQuery.data) {
      loadFlow(flowQuery.data)
      lastSavedSignatureRef.current = getFlowSignature(flowQuery.data)
      hasLoadedFlowRef.current = true
    }
  }, [flowQuery.data, loadFlow])

  useEffect(() => {
    setFlowNameDraft(flowName)
  }, [flowName])

  const currentFlowPayload = useMemo(
    () => ({
      aiContext,
      description: flowDescription,
      docs,
      edges,
      id: flowId ?? '',
      name: flowName,
      nodes,
      settings,
      tasks,
    }),
    [aiContext, docs, edges, flowDescription, flowId, flowName, nodes, settings, tasks],
  )
  const currentFlowSignature = useMemo(
    () => getFlowSignature(currentFlowPayload),
    [currentFlowPayload],
  )

  const saveFlowMutation = useMutation({
    mutationFn: () =>
      saveFlow(flowId!, {
        aiContext,
        description: flowDescription,
        docs,
        edges,
        name: flowName,
        nodes,
        settings,
        tasks,
      }),
    onSuccess: (flow) => {
      lastSavedSignatureRef.current = getFlowSignature(flow)
      loadFlow(flow)
    },
  })

  useEffect(() => {
    if (
      !flowId ||
      !hasLoadedFlowRef.current ||
      flowQuery.isPending ||
      flowQuery.isError ||
      currentFlowSignature === lastSavedSignatureRef.current
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      saveFlow(flowId, currentFlowPayload)
        .then((flow) => {
          lastSavedSignatureRef.current = getFlowSignature(flow)
        })
        .catch(() => {
          lastSavedSignatureRef.current = null
        })
    }, 800)

    return () => window.clearTimeout(timeoutId)
  }, [
    currentFlowPayload,
    currentFlowSignature,
    flowId,
    flowQuery.isError,
    flowQuery.isPending,
  ])

  if (!flowId) {
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 p-6">
        <p className="text-sm text-zinc-600">Missing flow ID.</p>
      </main>
    )
  }

  if (flowQuery.isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 p-6">
        <p className="text-sm text-zinc-600">Loading flow...</p>
      </main>
    )
  }

  if (flowQuery.isError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-zinc-50 p-6 text-center">
        <div>
          <p className="text-sm font-semibold text-zinc-950">Flow not available</p>
          <p className="mt-1 text-sm text-zinc-600">
            Check that the backend is running and the flow ID exists.
          </p>
          <Link
            className="mt-4 inline-flex rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            to="/flows"
          >
            Go back
          </Link>
        </div>
      </main>
    )
  }

  const realtimeButtonLabel = realtime.isConnecting
    ? 'Connecting...'
    : realtime.isActive
      ? 'Stop'
      : 'Talk to flow'
  const showRealtimePanel =
    realtime.isActive ||
    realtime.isConnecting ||
    Boolean(realtime.error) ||
    realtime.messages.length > 0
  const hasUnsavedChanges = currentFlowSignature !== lastSavedSignatureRef.current
  const saveStatusDotClass = saveFlowMutation.isPending
    ? 'bg-amber-500'
    : hasUnsavedChanges
      ? 'bg-blue-500'
      : 'bg-emerald-500'
  const saveStatusText = saveFlowMutation.isPending
    ? 'Saving changes'
    : hasUnsavedChanges
      ? 'Autosave pending'
      : 'Up to date'

  function commitFlowName() {
    const nextFlowName = flowNameDraft.trim() || 'Untitled flow'
    setFlowNameDraft(nextFlowName)
    setFlowName(nextFlowName)
  }

  return (
    <ReactFlowProvider>
      <div className="isolate flex h-dvh w-screen overflow-hidden bg-[oklch(0.982_0.003_240)] text-zinc-950 antialiased">
        <NodePalette
          isCanvasActive={activeWorkspaceTab === 'flowchart'}
          onOpenFlowchart={() => setActiveWorkspaceTab('flowchart')}
        />
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-950/8 bg-white/94 px-5 backdrop-blur-md">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <Link
                aria-label="Back to flows"
                className="grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                to="/flows"
              >
                <svg
                  aria-hidden="true"
                  className="size-4"
                  fill="none"
                  viewBox="0 0 16 16"
                >
                  <path
                    d="M9.5 3.5L5 8l4.5 4.5"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                  />
                </svg>
              </Link>

              <div className="flex min-w-0 items-center gap-2 text-sm">
                <Link
                  className="shrink-0 rounded-md px-1.5 py-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  to="/flows"
                >
                  Flows
                </Link>
                <p className="shrink-0 text-zinc-300">/</p>
                <div className="flex min-w-0 items-center gap-2">
                    <input
                      aria-label="Flow name"
                      className="min-w-0 max-w-72 truncate rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-zinc-950 outline-none transition hover:border-zinc-950/10 hover:bg-white focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                      onBlur={commitFlowName}
                      onChange={(event) => setFlowNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.currentTarget.blur()
                        }
                      }}
                      value={flowNameDraft}
                    />
                    <div
                      aria-label={saveStatusText}
                      className={`size-2 rounded-full ${saveStatusDotClass}`}
                      title={saveStatusText}
                    />
                </div>
              </div>

              <nav
                aria-label="Workspace"
                className="flex min-w-0 items-center gap-1 overflow-x-auto rounded-lg bg-zinc-100/80 p-1 ring-1 ring-zinc-950/8"
              >
                <WorkspaceTabButton
                  active={activeWorkspaceTab === 'flowchart'}
                  onClick={() => setActiveWorkspaceTab('flowchart')}
                >
                  Flowchart
                </WorkspaceTabButton>
                <WorkspaceTabButton
                  active={activeWorkspaceTab === 'tasks'}
                  count={tasks.length}
                  onClick={() => setActiveWorkspaceTab('tasks')}
                >
                  Tasks
                </WorkspaceTabButton>
                <WorkspaceTabButton
                  active={activeWorkspaceTab === 'docs'}
                  count={docs.length}
                  onClick={() => setActiveWorkspaceTab('docs')}
                >
                  Docs
                </WorkspaceTabButton>
              </nav>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-2">
              <div className="relative">
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/8 transition hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  onClick={() => setViewMenuOpen((isOpen) => !isOpen)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="size-4"
                    fill="none"
                    viewBox="0 0 16 16"
                  >
                    <path
                      d="M3.5 5.5h9M3.5 8h9M3.5 10.5h9"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                  View
                </button>
                {viewMenuOpen ? (
                  <div className="absolute right-0 top-full z-30 mt-2 grid w-64 gap-3 rounded-lg bg-white p-3 shadow-[0_24px_48px_-28px_rgba(24,24,27,0.45)] ring-1 ring-zinc-950/10">
                    <label className="grid gap-1.5">
                      <p className="text-[0.72rem] font-medium text-zinc-500">
                        Flow note
                      </p>
                      <input
                        aria-label="Flow description"
                        className="rounded-md border border-zinc-950/10 bg-white px-2.5 py-2 text-sm text-zinc-800 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                        onChange={(event) =>
                          setFlowDescription(event.target.value)
                        }
                        placeholder="Add a short note."
                        value={flowDescription}
                      />
                    </label>
                    <div className="grid gap-1.5">
                      <p className="text-[0.72rem] font-medium text-zinc-500">
                        Lines
                      </p>
                      <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1">
                        <button
                          className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                            settings.edgeLineMode === 'curved'
                              ? 'bg-white text-zinc-950 shadow-[0_10px_18px_-16px_rgba(24,24,27,0.4)]'
                              : 'text-zinc-600 hover:text-zinc-950'
                          }`}
                          onClick={() => setEdgeLineMode('curved')}
                          type="button"
                        >
                          Curved
                        </button>
                        <button
                          className={`rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                            settings.edgeLineMode === 'straight'
                              ? 'bg-white text-zinc-950 shadow-[0_10px_18px_-16px_rgba(24,24,27,0.4)]'
                              : 'text-zinc-600 hover:text-zinc-950'
                          }`}
                          onClick={() => setEdgeLineMode('straight')}
                          type="button"
                        >
                          Straight
                        </button>
                      </div>
                    </div>
                    <button
                      className={`rounded-md px-2.5 py-2 text-left text-sm font-medium transition ${
                        aiContext.trim()
                          ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          : 'bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                      }`}
                      onClick={() => {
                        setContextOpen(true)
                        setViewMenuOpen(false)
                      }}
                      type="button"
                    >
                      Flow context
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/8 transition hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                disabled={saveFlowMutation.isPending}
                onClick={() => saveFlowMutation.mutate()}
                type="button"
              >
                {saveFlowMutation.isPending ? 'Saving' : 'Share'}
              </button>
              <button
                aria-pressed={realtime.isActive}
                className={`rounded-lg px-3 py-2 text-sm font-semibold text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                  realtime.isActive
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                onClick={realtime.toggle}
                type="button"
              >
                {realtimeButtonLabel}
              </button>
            </div>
          </header>
          {activeWorkspaceTab === 'flowchart' ? (
            <div className="flex min-h-0 flex-1">
              <FlowCanvas />
              {showRealtimePanel ? (
                <VoiceConversationPanel
                  activity={realtime.activity}
                  error={realtime.error}
                  isActive={realtime.isActive}
                  isConnecting={realtime.isConnecting}
                  messages={realtime.messages}
                  onClear={realtime.clearMessages}
                />
              ) : (
                <NodeDetailsPanel />
              )}
            </div>
          ) : activeWorkspaceTab === 'tasks' ? (
            <WorkflowTasksTable
              onOpenNode={() => setActiveWorkspaceTab('flowchart')}
            />
          ) : (
            <DocsWorkspace onOpenNode={() => setActiveWorkspaceTab('flowchart')} />
          )}
        </main>
        {contextOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/30 p-5">
            <div className="w-full max-w-2xl rounded-lg bg-white shadow-2xl ring-1 ring-zinc-950/10">
              <div className="flex items-start justify-between gap-4 border-b border-zinc-950/10 p-5">
                <div>
                  <p className="text-base font-semibold text-zinc-950">
                    Flow context
                  </p>
                  <p className="mt-1 max-w-[64ch] text-sm text-pretty text-zinc-600">
                    Add people, roles, assignment rules, channels, and project
                    background for this flow.
                  </p>
                </div>
                <button
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  onClick={() => setContextOpen(false)}
                  type="button"
                >
                  Close
                </button>
              </div>
              <div className="grid gap-3 p-5">
                <textarea
                  className="min-h-72 resize-none rounded-lg border border-zinc-950/10 bg-white p-3 text-sm text-zinc-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  onChange={(event) => setAiContext(event.target.value)}
                  placeholder={`People and rules:
Rahul owns WhatsApp follow-ups.
Asha handles approvals.
Payment tasks go to Finance.
If the task is about customer follow-up, assign it to Rahul.`}
                  value={aiContext}
                />
                <p className="text-sm text-zinc-500">
                  This autosaves with the flow and is sent to voice mode when
                  you click Talk to flow.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ReactFlowProvider>
  )
}
