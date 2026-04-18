import type { Edge, Node } from '@xyflow/react'

export type FlowNodeKind =
  | 'start'
  | 'process'
  | 'decision'
  | 'message'
  | 'note'
  | 'task'
  | 'wait'
  | 'end'

export type NodeNote = {
  id: string
  body: string
  createdAt: string
}

export type TaskChannel = 'general' | 'whatsapp' | 'call' | 'email'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'cancelled'

export type EdgeLineMode = 'curved' | 'straight'

export type FlowSettings = {
  edgeLineMode: EdgeLineMode
}

export const defaultFlowSettings: FlowSettings = {
  edgeLineMode: 'curved',
}

export type NodeTask = {
  id: string
  nodeId: string
  sourceNoteId?: string
  title: string
  assignee: string
  due: string
  channel: TaskChannel
  details: string
  status: TaskStatus
  createdAt: string
}

export type FlowDoc = {
  id: string
  nodeId?: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export type TaskExtractionSuggestion = {
  title: string
  assignee: string
  due: string
  channel: TaskChannel
  details: string
}

export type FlowNodeData = {
  kind: FlowNodeKind
  title: string
  description: string
  notes: NodeNote[]
}

export type FlowNode = Node<FlowNodeData, 'flowNode'>
export type FlowEdge = Edge

export type FlowDocument = {
  id: string
  name: string
  description: string
  aiContext: string
  settings: FlowSettings
  nodes: FlowNode[]
  edges: FlowEdge[]
  docs: FlowDoc[]
  tasks: NodeTask[]
}
