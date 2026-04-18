import { MarkerType } from '@xyflow/react'
import type {
  EdgeLineMode,
  FlowDocument,
  FlowDoc,
  FlowEdge,
  FlowSettings,
  FlowNode,
  FlowNodeKind,
  NodeTask,
  NodeNote,
  TaskExtractionSuggestion,
  TaskChannel,
  TaskStatus,
} from '../canvas/flowTypes'
import { defaultFlowSettings } from '../canvas/flowTypes'
import { normalizeDecisionEdges } from '../canvas/flowUtils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api'

type ApiNote = {
  id: string
  body: string
  createdAt: string
}

type ApiTask = {
  id: string
  nodeId: string
  noteId: string
  title: string
  description: string
  assignee: string
  channel: string
  status: string
  due: string
  metadata: Record<string, unknown>
  createdAt: string
}

type ApiDoc = {
  id: string
  nodeId: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

type ApiNode = {
  id: string
  kind: FlowNodeKind
  title: string
  description: string
  position: {
    x: number
    y: number
  }
  notes: ApiNote[]
}

type ApiEdge = {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  label: string
  condition: string
}

type ApiFlow = {
  id: string
  name: string
  description: string
  aiContext?: string
  settings?: Partial<FlowSettings>
  nodes: ApiNode[]
  edges: ApiEdge[]
  docs: ApiDoc[]
  tasks: ApiTask[]
}

type ApiFlowSummary = {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  nodeCount: number
  edgeCount: number
}

type ApiTaskExtractionSuggestion = {
  title: string
  description: string
  assignee: string
  due: string
  channel: string
}

type ApiTaskExtractionResponse = {
  suggestions: ApiTaskExtractionSuggestion[]
}

export type RealtimeSessionToken = {
  clientSecret: string
  expiresAt: number | null
  model: string
}

type SaveFlowPayload = {
  aiContext: string
  description: string
  edges: FlowEdge[]
  docs: FlowDoc[]
  name: string
  nodes: FlowNode[]
  settings: FlowSettings
  tasks: NodeTask[]
}

type ExtractTasksFromNotePayload = {
  allNotes: string[]
  aiContext: string
  existingTasks: NodeTask[]
  flowDescription: string
  flowName: string
  nodeId: string
  nodeKind: FlowNodeKind
  nodeTitle: string
  noteBody: string
  noteId: string
}

export type FlowSummary = ApiFlowSummary

function mapNote(note: ApiNote): NodeNote {
  return {
    id: note.id,
    body: note.body,
    createdAt: note.createdAt,
  }
}

function mapChannel(channel: string): TaskChannel {
  if (
    channel === 'whatsapp' ||
    channel === 'call' ||
    channel === 'email' ||
    channel === 'general'
  ) {
    return channel
  }

  return 'general'
}

function mapStatus(status: string): TaskStatus {
  if (
    status === 'in_progress' ||
    status === 'done' ||
    status === 'cancelled' ||
    status === 'todo'
  ) {
    return status
  }

  return 'todo'
}

function mapEdgeLineMode(value: unknown): EdgeLineMode {
  return value === 'straight' ? 'straight' : 'curved'
}

function mapSettings(settings?: Partial<FlowSettings>): FlowSettings {
  return {
    ...defaultFlowSettings,
    edgeLineMode: mapEdgeLineMode(settings?.edgeLineMode),
  }
}

function getEdgeType(edgeLineMode: EdgeLineMode) {
  return edgeLineMode === 'straight' ? 'straight' : undefined
}

function mapTask(task: ApiTask): NodeTask {
  return {
    id: task.id,
    nodeId: task.nodeId,
    sourceNoteId: task.noteId || undefined,
    title: task.title,
    assignee: task.assignee,
    due:
      task.due ||
      (typeof task.metadata?.due === 'string' ? task.metadata.due : ''),
    channel: mapChannel(task.channel),
    details: task.description,
    status: mapStatus(task.status),
    createdAt: task.createdAt,
  }
}

function mapDoc(doc: ApiDoc): FlowDoc {
  return {
    id: doc.id,
    nodeId: doc.nodeId || undefined,
    title: doc.title,
    body: doc.body,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

function mapTaskExtractionSuggestion(
  suggestion: ApiTaskExtractionSuggestion,
): TaskExtractionSuggestion {
  return {
    title: suggestion.title,
    assignee: suggestion.assignee,
    due: suggestion.due,
    channel: mapChannel(suggestion.channel),
    details: suggestion.description,
  }
}

function mapNode(node: ApiNode): FlowNode {
  return {
    id: node.id,
    type: 'flowNode',
    position: node.position,
    data: {
      kind: node.kind,
      title: node.title,
      description: node.description,
      notes: node.notes.map(mapNote),
    },
  }
}

function mapEdge(edge: ApiEdge, edgeLineMode: EdgeLineMode): FlowEdge {
  return {
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle || undefined,
    target: edge.target,
    targetHandle: edge.targetHandle || undefined,
    label: edge.label || undefined,
    type: getEdgeType(edgeLineMode),
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#2563eb',
    },
    style: {
      stroke: '#2563eb',
      strokeWidth: 2,
    },
  }
}

function mapFlow(flow: ApiFlow): FlowDocument {
  const settings = mapSettings(flow.settings)
  const nodes = flow.nodes.map(mapNode)
  const edges = normalizeDecisionEdges(
    nodes,
    flow.edges.map((edge) => mapEdge(edge, settings.edgeLineMode)),
  )

  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    aiContext: flow.aiContext ?? '',
    settings,
    nodes,
    edges,
    docs: (flow.docs ?? []).map(mapDoc),
    tasks: (flow.tasks ?? []).map(mapTask),
  }
}

async function requestFlow(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return mapFlow((await response.json()) as ApiFlow)
}

async function requestJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    ...init,
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as T
}

async function getErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { detail?: unknown }
    if (typeof payload.detail === 'string' && payload.detail.trim()) {
      return payload.detail
    }
  } catch {
    // Fall back to a generic status-based error below.
  }

  return `Flow API request failed with ${response.status}`
}

export function listFlows() {
  return requestJson<FlowSummary[]>('/flows/')
}

export function createFlow() {
  return requestFlow('/flows/', {
    method: 'POST',
    body: JSON.stringify({ name: 'Untitled flow' }),
  })
}

export function getFlow(flowId: string) {
  return requestFlow(`/flows/${flowId}/`)
}

export async function extractTasksFromNote(
  flowId: string,
  payload: ExtractTasksFromNotePayload,
) {
  const response = await requestJson<ApiTaskExtractionResponse>(
    `/flows/${flowId}/notes/extract-tasks/`,
    {
      method: 'POST',
      body: JSON.stringify({
        allNotes: payload.allNotes,
        aiContext: payload.aiContext,
        nodeId: payload.nodeId,
        nodeTitle: payload.nodeTitle,
        nodeKind: payload.nodeKind,
        noteId: payload.noteId,
        noteBody: payload.noteBody,
        flowName: payload.flowName,
        flowDescription: payload.flowDescription,
        existingTasks: payload.existingTasks.map((task) => ({
          title: task.title,
          description: task.details,
          assignee: task.assignee,
          due: task.due,
          channel: task.channel,
          status: task.status,
        })),
      }),
    },
  )

  return response.suggestions.map(mapTaskExtractionSuggestion)
}

export function createRealtimeSession(flowId: string) {
  return requestJson<RealtimeSessionToken>(
    `/flows/${flowId}/realtime/session/`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
  )
}

export function saveFlow(flowId: string, flow: SaveFlowPayload) {
  return requestFlow(`/flows/${flowId}/`, {
    method: 'PUT',
    body: JSON.stringify({
      name: flow.name,
      description: flow.description,
      aiContext: flow.aiContext,
      settings: flow.settings,
      nodes: flow.nodes.map((node) => ({
        id: node.id,
        kind: node.data.kind,
        title: node.data.title,
        description: node.data.description,
        position: node.position,
        data: {
          ...node.data,
          notes: undefined,
        },
        notes: node.data.notes,
      })),
      edges: flow.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        label: typeof edge.label === 'string' ? edge.label : '',
        condition: '',
      })),
      docs: flow.docs.map((doc) => ({
        id: doc.id,
        nodeId: doc.nodeId,
        title: doc.title,
        body: doc.body,
      })),
      tasks: flow.tasks.map((task) => ({
        id: task.id,
        nodeId: task.nodeId,
        noteId: task.sourceNoteId,
        title: task.title,
        description: task.details,
        assignee: task.assignee,
        due: task.due,
        channel: task.channel,
        status: task.status,
      })),
    }),
  })
}
