import type { XYPosition } from '@xyflow/react'
import type { FlowEdge, FlowNode, FlowNodeKind } from './flowTypes'

const childHorizontalGap = 340
const childCollisionWidth = 250
const childCollisionHeight = 180
const childFanoutOffsets = [0, 1, -1, 2, -2, 3, -3, 4, -4]

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

export function getDefaultTitle(kind: FlowNodeKind) {
  const titles: Record<FlowNodeKind, string> = {
    start: 'Start',
    process: 'Process step',
    decision: 'Decision',
    message: 'Message',
    note: 'Note',
    task: 'Task',
    wait: 'Wait',
    end: 'End',
  }

  return titles[kind]
}

function isPositionClear(position: XYPosition, siblingNodes: FlowNode[]) {
  return siblingNodes.every(
    (node) =>
      Math.abs(node.position.x - position.x) >= childCollisionWidth ||
      Math.abs(node.position.y - position.y) >= childCollisionHeight,
  )
}

export function getChildFanoutPosition({
  edges,
  nodes,
  preferredPosition,
  sourceNodeId,
}: {
  edges: FlowEdge[]
  nodes: FlowNode[]
  preferredPosition: XYPosition
  sourceNodeId: string
}) {
  const sourceNode = nodes.find((node) => node.id === sourceNodeId)
  const siblingNodes = edges
    .filter((edge) => edge.source === sourceNodeId)
    .map((edge) => nodes.find((node) => node.id === edge.target))
    .filter((node): node is FlowNode => Boolean(node))

  if (siblingNodes.length === 0 || isPositionClear(preferredPosition, siblingNodes)) {
    return preferredPosition
  }

  const baseX = sourceNode?.position.x ?? preferredPosition.x
  const candidatePositions = childFanoutOffsets.map((offset) => ({
    x: baseX + offset * childHorizontalGap,
    y: preferredPosition.y,
  }))

  return (
    candidatePositions.find((position) => isPositionClear(position, siblingNodes)) ??
    {
      x: baseX + siblingNodes.length * childHorizontalGap,
      y: preferredPosition.y,
    }
  )
}

function normalizeBranchLabel(label: unknown) {
  if (typeof label !== 'string') {
    return ''
  }

  const value = label.trim()
  if (!value) {
    return ''
  }

  const normalized = value.toLowerCase()
  if (['yes', 'y', 'true', 'approved', 'pass'].includes(normalized)) {
    return 'YES'
  }

  if (['no', 'n', 'false', 'rejected', 'reject', 'fail'].includes(normalized)) {
    return 'NO'
  }

  return value
}

function getDecisionHandleFromLabel(label: string) {
  if (label === 'YES') {
    return 'source-left'
  }

  if (label === 'NO') {
    return 'source-right'
  }

  return undefined
}

function getDecisionBranchLabelTheme(label: string) {
  if (label === 'YES') {
    return {
      labelBgBorderRadius: 7,
      labelBgPadding: [8, 5] as [number, number],
      labelBgStyle: {
        fill: '#ECFDF5',
        stroke: '#BBF7D0',
        strokeWidth: 1,
      },
      labelShowBg: true,
      labelStyle: {
        fill: '#15803D',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0,
      },
    }
  }

  if (label === 'NO') {
    return {
      labelBgBorderRadius: 7,
      labelBgPadding: [8, 5] as [number, number],
      labelBgStyle: {
        fill: '#FEF2F2',
        stroke: '#FECACA',
        strokeWidth: 1,
      },
      labelShowBg: true,
      labelStyle: {
        fill: '#B91C1C',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0,
      },
    }
  }

  if (label !== 'YES' && label !== 'NO') {
    return {
      labelBgBorderRadius: undefined,
      labelBgPadding: undefined,
      labelBgStyle: undefined,
      labelShowBg: undefined,
      labelStyle: undefined,
    }
  }

  return {}
}

export function normalizeDecisionEdges(nodes: FlowNode[], edges: FlowEdge[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const decisionOutgoingByNodeId = new Map<string, FlowEdge[]>()

  for (const edge of edges) {
    const sourceNode = nodeById.get(edge.source)
    if (sourceNode?.data.kind !== 'decision') {
      continue
    }

    decisionOutgoingByNodeId.set(edge.source, [
      ...(decisionOutgoingByNodeId.get(edge.source) ?? []),
      edge,
    ])
  }

  return edges.map((edge) => {
    const sourceNode = nodeById.get(edge.source)
    if (sourceNode?.data.kind !== 'decision') {
      return edge
    }

    const targetNode = nodeById.get(edge.target)
    const siblings = decisionOutgoingByNodeId.get(edge.source) ?? [edge]
    const normalizedLabel = normalizeBranchLabel(edge.label)
    const labelHandle = getDecisionHandleFromLabel(normalizedLabel)
    const sortedSiblings = [...siblings].sort((left, right) => {
      const leftTarget = nodeById.get(left.target)
      const rightTarget = nodeById.get(right.target)
      return (leftTarget?.position.x ?? 0) - (rightTarget?.position.x ?? 0)
    })
    const positionHandle =
      sortedSiblings.length >= 2
        ? sortedSiblings[0]?.id === edge.id
          ? 'source-left'
          : sortedSiblings[sortedSiblings.length - 1]?.id === edge.id
            ? 'source-right'
            : undefined
        : targetNode
          ? targetNode.position.x < sourceNode.position.x
            ? 'source-left'
            : 'source-right'
          : undefined
    const sourceHandle =
      edge.sourceHandle && edge.sourceHandle !== 'source-bottom'
        ? edge.sourceHandle
        : labelHandle ?? positionHandle ?? edge.sourceHandle ?? 'source-right'
    const label =
      normalizedLabel ||
      (sortedSiblings.length === 2
        ? sourceHandle === 'source-left'
          ? 'YES'
          : sourceHandle === 'source-right'
            ? 'NO'
            : undefined
        : undefined)

    return {
      ...edge,
      label,
      ...getDecisionBranchLabelTheme(label ?? ''),
      sourceHandle,
      targetHandle: 'target-top',
    }
  })
}
