import type { FlowEdge, FlowNode } from './flowTypes'

export const initialNodes: FlowNode[] = [
  {
    id: 'node_start',
    type: 'flowNode',
    position: { x: 120, y: 120 },
    data: {
      kind: 'start',
      title: 'Start',
      description: 'Begin the flow here.',
      notes: [],
    },
  },
]

export const initialEdges: FlowEdge[] = []

