import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  MarkerType,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react'
import { create } from 'zustand'
import { initialEdges, initialNodes } from '../canvas/initialFlow'
import {
  createId,
  getDefaultTitle,
  normalizeDecisionEdges,
} from '../canvas/flowUtils'
import type {
  EdgeLineMode,
  FlowDocument,
  FlowDoc,
  FlowEdge,
  FlowNode,
  FlowNodeKind,
  FlowSettings,
  NodeTask,
  TaskChannel,
} from '../canvas/flowTypes'
import { defaultFlowSettings } from '../canvas/flowTypes'

const defaultEdgeColor = '#A1A1AA'

function getValidSourceHandle(handleId?: string | null) {
  return handleId?.startsWith('source-') ? handleId : 'source-right'
}

function getTargetHandleForSource(sourceHandle: string) {
  return sourceHandle === 'source-bottom' || sourceHandle === 'source-left'
    ? 'target-top'
    : 'target-left'
}

function getEdgeType(edgeLineMode: EdgeLineMode) {
  return edgeLineMode === 'straight' ? 'straight' : undefined
}

function getEdgeObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function applyEdgeLineMode(edge: FlowEdge, edgeLineMode: EdgeLineMode): FlowEdge {
  return {
    ...edge,
    markerEnd: {
      color: defaultEdgeColor,
      type: MarkerType.ArrowClosed,
      ...getEdgeObject(edge.markerEnd),
    },
    style: {
      stroke: defaultEdgeColor,
      strokeWidth: 2,
      ...getEdgeObject(edge.style),
    },
    type: getEdgeType(edgeLineMode),
  }
}

type FlowEditorState = {
  aiContext: string
  flowDescription: string
  flowId: string | null
  flowName: string
  settings: FlowSettings
  nodes: FlowNode[]
  edges: FlowEdge[]
  docs: FlowDoc[]
  tasks: NodeTask[]
  selectedNodeId: string | null
  loadFlow: (flow: FlowDocument) => void
  setAiContext: (aiContext: string) => void
  setFlowName: (name: string) => void
  setEdgeLineMode: (edgeLineMode: EdgeLineMode) => void
  setSelectedNodeId: (nodeId: string | null) => void
  onNodesChange: (changes: NodeChange<FlowNode>[]) => void
  onEdgesChange: (changes: EdgeChange<FlowEdge>[]) => void
  onConnect: (connection: Connection) => void
  addNode: (kind: FlowNodeKind, position?: XYPosition) => void
  addVoiceNode: (node: {
    description?: string
    kind: FlowNodeKind
    position?: XYPosition
    title: string
  }) => string
  addConnectedNode: (
    kind: FlowNodeKind,
    position: XYPosition,
    sourceNodeId: string,
    sourceHandle?: string | null,
  ) => void
  connectNodes: (
    sourceNodeId: string,
    targetNodeId: string,
    label?: string,
  ) => void
  updateNodeData: (
    nodeId: string,
    updates: Partial<FlowNode['data']>,
  ) => void
  moveNode: (nodeId: string, position: XYPosition) => void
  addNote: (nodeId: string, body: string) => string
  updateNote: (nodeId: string, noteId: string, body: string) => void
  addDoc: (doc: {
    body?: string
    nodeId?: string
    title: string
  }) => void
  updateDoc: (docId: string, updates: Partial<FlowDoc>) => void
  deleteDoc: (docId: string) => void
  addTask: (task: {
    assignee?: string
    channel?: TaskChannel
    details?: string
    due?: string
    nodeId: string
    sourceNoteId?: string
    title: string
  }) => void
  updateTask: (taskId: string, updates: Partial<NodeTask>) => void
}

export const useFlowEditorStore = create<FlowEditorState>((set) => ({
  aiContext: '',
  flowDescription: '',
  flowId: null,
  flowName: 'Draft flow',
  settings: defaultFlowSettings,
  nodes: initialNodes,
  edges: initialEdges,
  docs: [],
  tasks: [],
  selectedNodeId: null,
  loadFlow: (flow) =>
    set({
      aiContext: flow.aiContext,
      flowDescription: flow.description,
      flowId: flow.id,
      flowName: flow.name,
      settings: flow.settings,
      nodes: flow.nodes,
      edges: normalizeDecisionEdges(flow.nodes, flow.edges).map((edge) =>
        applyEdgeLineMode(edge, flow.settings.edgeLineMode),
      ),
      docs: flow.docs,
      tasks: flow.tasks,
      selectedNodeId: null,
    }),
  setAiContext: (aiContext) => set({ aiContext }),
  setFlowName: (name) =>
    set({
      flowName: name.trim() || 'Untitled flow',
    }),
  setEdgeLineMode: (edgeLineMode) =>
    set((state) => ({
      settings: {
        ...state.settings,
        edgeLineMode,
      },
      edges: state.edges.map((edge) => applyEdgeLineMode(edge, edgeLineMode)),
    })),
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),
  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),
  onConnect: (connection) =>
    set((state) => ({
      edges: normalizeDecisionEdges(
        state.nodes,
        addEdge(
          {
            ...connection,
            id: createId('edge'),
            type: getEdgeType(state.settings.edgeLineMode),
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: defaultEdgeColor,
            },
            style: {
              stroke: defaultEdgeColor,
              strokeWidth: 2,
            },
          },
          state.edges,
        ).map((edge) => applyEdgeLineMode(edge, state.settings.edgeLineMode)),
      ),
    })),
  addNode: (kind, position = { x: 220, y: 160 }) =>
    set((state) => {
      const nodeId = createId('node')
      const nextNode: FlowNode = {
        id: nodeId,
        type: 'flowNode',
        position,
        data: {
          kind,
          title: getDefaultTitle(kind),
          description: '',
          notes: [],
        },
      }

      return {
        nodes: [...state.nodes, nextNode],
        selectedNodeId: nodeId,
      }
    }),
  addVoiceNode: (node) => {
    const nodeId = createId('node')

    set((state) => ({
      nodes: [
        ...state.nodes,
        {
          id: nodeId,
          type: 'flowNode',
          position: node.position ?? { x: 240 + state.nodes.length * 40, y: 180 },
          data: {
            kind: node.kind,
            title: node.title.trim() || getDefaultTitle(node.kind),
            description: node.description?.trim() ?? '',
            notes: [],
          },
        },
      ],
      selectedNodeId: nodeId,
    }))

    return nodeId
  },
  addConnectedNode: (kind, position, sourceNodeId, sourceHandle) =>
    set((state) => {
      const nodeId = createId('node')
      const normalizedSourceHandle = getValidSourceHandle(sourceHandle)
      const nextNode: FlowNode = {
        id: nodeId,
        type: 'flowNode',
        position,
        data: {
          kind,
          title: getDefaultTitle(kind),
          description: '',
          notes: [],
        },
      }
      const nextEdge: FlowEdge = {
        id: createId('edge'),
        source: sourceNodeId,
        sourceHandle: normalizedSourceHandle,
        target: nodeId,
        targetHandle: getTargetHandleForSource(normalizedSourceHandle),
        type: getEdgeType(state.settings.edgeLineMode),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#2563eb',
        },
        style: {
          stroke: '#2563eb',
          strokeWidth: 2,
        },
      }

      return {
        nodes: [...state.nodes, nextNode],
        edges: normalizeDecisionEdges(
          [...state.nodes, nextNode],
          [...state.edges, nextEdge],
        ).map((edge) => applyEdgeLineMode(edge, state.settings.edgeLineMode)),
        selectedNodeId: nodeId,
      }
    }),
  connectNodes: (sourceNodeId, targetNodeId, label = '') =>
    set((state) => {
      if (
        !sourceNodeId ||
        !targetNodeId ||
        sourceNodeId === targetNodeId ||
        !state.nodes.some((node) => node.id === sourceNodeId) ||
        !state.nodes.some((node) => node.id === targetNodeId) ||
        state.edges.some(
          (edge) => edge.source === sourceNodeId && edge.target === targetNodeId,
        )
      ) {
        return state
      }

      const nextEdge: FlowEdge = {
        id: createId('edge'),
        source: sourceNodeId,
        sourceHandle: 'source-bottom',
        target: targetNodeId,
        targetHandle: 'target-top',
        label: label.trim() || undefined,
        type: getEdgeType(state.settings.edgeLineMode),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#2563eb',
        },
        style: {
          stroke: '#2563eb',
          strokeWidth: 2,
        },
      }

      return {
        edges: normalizeDecisionEdges(
          state.nodes,
          [...state.edges, nextEdge],
        ).map((edge) => applyEdgeLineMode(edge, state.settings.edgeLineMode)),
        selectedNodeId: targetNodeId,
      }
    }),
  updateNodeData: (nodeId, updates) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...updates } }
          : node,
      ),
    })),
  moveNode: (nodeId, position) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, position } : node,
      ),
      selectedNodeId: nodeId,
    })),
  addNote: (nodeId, body) => {
    const noteId = createId('note')
    const createdAt = new Date().toISOString()

    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                notes: [
                  ...node.data.notes,
                  {
                    id: noteId,
                    body,
                    createdAt,
                  },
                ],
              },
            }
          : node,
      ),
    }))

    return noteId
  },
  updateNote: (nodeId, noteId, body) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                notes: node.data.notes.map((note) =>
                  note.id === noteId ? { ...note, body } : note,
                ),
              },
            }
          : node,
      ),
    })),
  addDoc: (doc) =>
    set((state) => ({
      docs: [
        ...state.docs,
        {
          id: createId('doc'),
          nodeId: doc.nodeId,
          title: doc.title.trim(),
          body: doc.body?.trim() ?? '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    })),
  updateDoc: (docId, updates) =>
    set((state) => ({
      docs: state.docs.map((doc) =>
        doc.id === docId
          ? { ...doc, ...updates, updatedAt: new Date().toISOString() }
          : doc,
      ),
    })),
  deleteDoc: (docId) =>
    set((state) => ({
      docs: state.docs.filter((doc) => doc.id !== docId),
    })),
  addTask: (task) =>
    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          id: createId('task'),
          nodeId: task.nodeId,
          sourceNoteId: task.sourceNoteId,
          title: task.title.trim(),
          assignee: task.assignee?.trim() ?? '',
          due: task.due?.trim() ?? '',
          channel: task.channel ?? 'general',
          details: task.details?.trim() ?? '',
          status: 'todo',
          createdAt: new Date().toISOString(),
        },
      ],
    })),
  updateTask: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((task) =>
        task.id === taskId ? { ...task, ...updates } : task,
      ),
    })),
}))
