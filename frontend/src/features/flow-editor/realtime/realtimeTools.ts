import type {
  EdgeLineMode,
  FlowDoc,
  FlowNode,
  FlowNodeKind,
  NodeTask,
  TaskChannel,
} from '../canvas/flowTypes'
import { useFlowEditorStore } from '../state/flowEditorStore'

const nodeKinds: FlowNodeKind[] = [
  'start',
  'process',
  'decision',
  'message',
  'note',
  'task',
  'wait',
  'end',
]
const taskChannels: TaskChannel[] = ['general', 'whatsapp', 'call', 'email']
const nodeVerticalGap = 90
const unlinkedNodeVerticalStep = 190

type RealtimeFunctionCall = {
  arguments?: string
  call_id?: string
  name?: string
  type?: string
}

type ToolResult = {
  data?: Record<string, unknown>
  message: string
  ok: boolean
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function parseArguments(value: string | undefined) {
  if (!value) {
    return {}
  }

  try {
    return asRecord(JSON.parse(value))
  } catch {
    return {}
  }
}

function isNodeKind(value: string): value is FlowNodeKind {
  return nodeKinds.includes(value as FlowNodeKind)
}

function isTaskChannel(value: string): value is TaskChannel {
  return taskChannels.includes(value as TaskChannel)
}

function isEdgeLineMode(value: string): value is EdgeLineMode {
  return value === 'curved' || value === 'straight'
}

function getNode(nodes: FlowNode[], nodeId: string) {
  return nodes.find((node) => node.id === nodeId)
}

function buildNotesContext(nodes: FlowNode[], nodeId = '') {
  return nodes
    .filter((node) => !nodeId || node.id === nodeId)
    .map((node) => ({
      nodeId: node.id,
      nodeTitle: node.data.title,
      notes: node.data.notes.map((note) => ({
        id: note.id,
        body: note.body,
        createdAt: note.createdAt,
      })),
    }))
}

function resolveNodeId(nodeId: string, nodes: FlowNode[], selectedNodeId: string | null) {
  if (nodeId && getNode(nodes, nodeId)) {
    return nodeId
  }

  if (selectedNodeId && getNode(nodes, selectedNodeId)) {
    return selectedNodeId
  }

  return nodes[0]?.id ?? ''
}

function getNodeRelatedItems(
  nodeId: string,
  tasks: NodeTask[],
  docs: FlowDoc[],
) {
  return {
    docCount: docs.filter((doc) => doc.nodeId === nodeId).length,
    taskCount: tasks.filter((task) => task.nodeId === nodeId).length,
  }
}

function getMeasuredNodeHeight(node: FlowNode) {
  return node.measured?.height ?? node.height ?? node.initialHeight ?? 0
}

function getEstimatedNodeHeight(
  node: FlowNode,
  tasks: NodeTask[],
  docs: FlowDoc[],
) {
  const measuredHeight = getMeasuredNodeHeight(node)
  if (measuredHeight > 0) {
    return measuredHeight
  }

  const { docCount, taskCount } = getNodeRelatedItems(node.id, tasks, docs)
  const noteCount = node.data.notes.length

  if (node.data.kind === 'decision') {
    return 176
  }

  if (node.data.kind === 'start' || node.data.kind === 'end') {
    return 74
  }

  if (node.data.kind === 'note') {
    return 132 + (noteCount > 0 ? 48 : 0)
  }

  const taskPreviewCount = Math.min(taskCount, 2)
  const docPreviewCount = Math.min(docCount, 2)

  return (
    112 +
    (taskCount > 0 ? 42 + taskPreviewCount * 26 + (taskCount > 2 ? 18 : 0) : 34) +
    (noteCount > 0 ? 76 : 0) +
    (docCount > 0 ? 32 + docPreviewCount * 36 : 0)
  )
}

function getEstimatedNodeWidth(node: FlowNode) {
  const measuredWidth = node.measured?.width ?? node.width ?? node.initialWidth ?? 0
  if (measuredWidth > 0) {
    return measuredWidth
  }

  if (node.data.kind === 'decision') {
    return 240
  }

  if (node.data.kind === 'start' || node.data.kind === 'end') {
    return 224
  }

  return 280
}

function getNextNodePosition(
  afterNode: FlowNode | undefined,
  index: number,
  tasks: NodeTask[],
  docs: FlowDoc[],
) {
  if (afterNode) {
    return {
      x: afterNode.position.x,
      y:
        afterNode.position.y +
        getEstimatedNodeHeight(afterNode, tasks, docs) +
        nodeVerticalGap,
    }
  }

  return {
    x: 240,
    y: 180 + index * unlinkedNodeVerticalStep,
  }
}

export function buildRealtimeFlowContext() {
  const state = useFlowEditorStore.getState()

  return {
    flow: {
      id: state.flowId,
      name: state.flowName,
      description: state.flowDescription,
      aiContext: state.aiContext,
      settings: state.settings,
    },
    selectedNodeId: state.selectedNodeId,
    nodes: state.nodes.map((node) => ({
      id: node.id,
      kind: node.data.kind,
      title: node.data.title,
      description: node.data.description,
      position: node.position,
      size: {
        height: getEstimatedNodeHeight(node, state.tasks, state.docs),
        width: getEstimatedNodeWidth(node),
      },
      noteCount: node.data.notes.length,
      taskCount: state.tasks.filter((task) => task.nodeId === node.id).length,
      docCount: state.docs.filter((doc) => doc.nodeId === node.id).length,
    })),
    edges: state.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: typeof edge.label === 'string' ? edge.label : '',
    })),
    docs: state.docs.map((doc: FlowDoc) => ({
      id: doc.id,
      nodeId: doc.nodeId ?? '',
      title: doc.title,
    })),
    tasks: state.tasks.map((task: NodeTask) => ({
      id: task.id,
      nodeId: task.nodeId,
      title: task.title,
      assignee: task.assignee,
      due: task.due,
      channel: task.channel,
      status: task.status,
    })),
  }
}

export function executeRealtimeToolCall(call: RealtimeFunctionCall): ToolResult {
  const name = asString(call.name)
  const args = parseArguments(call.arguments)
  const state = useFlowEditorStore.getState()

  if (name === 'create_node') {
    const kind = asString(args.kind)
    const title = asString(args.title)
    const requestedAfterNodeId = asString(args.afterNodeId)
    const afterNodeId =
      requestedAfterNodeId ||
      (state.selectedNodeId && getNode(state.nodes, state.selectedNodeId)
        ? state.selectedNodeId
        : '')
    const afterNode = getNode(state.nodes, afterNodeId)
    const defaultPosition = getNextNodePosition(
      afterNode,
      state.nodes.length,
      state.tasks,
      state.docs,
    )
    const position = {
      x: afterNode ? defaultPosition.x : asNumber(args.x) ?? defaultPosition.x,
      y: afterNode ? defaultPosition.y : asNumber(args.y) ?? defaultPosition.y,
    }

    if (!isNodeKind(kind) || !title) {
      return { ok: false, message: 'create_node needs a valid kind and title.' }
    }

    const nodeId = state.addVoiceNode({
      description: asString(args.description),
      kind,
      position,
      title,
    })

    if (afterNode) {
      useFlowEditorStore.getState().connectNodes(afterNodeId, nodeId)
    }

    return {
      ok: true,
      message: `Created node: ${title}`,
      data: {
        nodeId,
        afterNodeId: afterNode ? afterNodeId : '',
        kind,
        title,
      },
    }
  }

  if (name === 'update_node') {
    const nodeId = resolveNodeId(
      asString(args.nodeId),
      state.nodes,
      state.selectedNodeId,
    )
    const node = getNode(state.nodes, nodeId)
    const kind = asString(args.kind)

    if (!node) {
      return { ok: false, message: 'No matching node found.' }
    }

    state.updateNodeData(nodeId, {
      description: asString(args.description) || node.data.description,
      kind: isNodeKind(kind) ? kind : node.data.kind,
      title: asString(args.title) || node.data.title,
    })

    return {
      ok: true,
      message: `Updated node: ${node.data.title}`,
      data: { nodeId },
    }
  }

  if (name === 'connect_nodes') {
    const sourceNodeId = asString(args.sourceNodeId)
    const targetNodeId = asString(args.targetNodeId)

    if (!getNode(state.nodes, sourceNodeId) || !getNode(state.nodes, targetNodeId)) {
      return { ok: false, message: 'connect_nodes needs valid source and target nodes.' }
    }

    state.connectNodes(sourceNodeId, targetNodeId, asString(args.label))

    return {
      ok: true,
      message: 'Connected nodes.',
      data: { sourceNodeId, targetNodeId },
    }
  }

  if (name === 'move_node') {
    const nodeId = asString(args.nodeId)
    const x = asNumber(args.x)
    const y = asNumber(args.y)
    const node = getNode(state.nodes, nodeId)

    if (!node || x === undefined || y === undefined) {
      return { ok: false, message: 'move_node needs a valid nodeId, x, and y.' }
    }

    state.moveNode(nodeId, { x, y })

    return {
      ok: true,
      message: `Moved node: ${node.data.title}`,
      data: { nodeId, position: { x, y } },
    }
  }

  if (name === 'add_note') {
    const nodeId = resolveNodeId(
      asString(args.nodeId),
      state.nodes,
      state.selectedNodeId,
    )
    const text = asString(args.text)

    if (!nodeId || !text) {
      return { ok: false, message: 'add_note needs a node and note text.' }
    }

    const noteId = state.addNote(nodeId, text)

    return {
      ok: true,
      message: 'Added note.',
      data: { nodeId, noteId },
    }
  }

  if (name === 'fetch_all_notes') {
    const nodeId = asString(args.nodeId)
    const notes = buildNotesContext(state.nodes, nodeId)

    return {
      ok: true,
      message: nodeId ? 'Fetched notes for node.' : 'Fetched all notes.',
      data: { notes },
    }
  }

  if (name === 'update_note') {
    const nodeId = asString(args.nodeId)
    const noteId = asString(args.noteId)
    const text = asString(args.text)
    const node = getNode(state.nodes, nodeId)
    const note = node?.data.notes.find((candidate) => candidate.id === noteId)

    if (!node || !note || !text) {
      return { ok: false, message: 'update_note needs a valid nodeId, noteId, and text.' }
    }

    state.updateNote(nodeId, noteId, text)

    return {
      ok: true,
      message: 'Updated note.',
      data: { nodeId, noteId },
    }
  }

  if (name === 'create_task') {
    const nodeId = resolveNodeId(
      asString(args.nodeId),
      state.nodes,
      state.selectedNodeId,
    )
    const title = asString(args.title)
    const channel = asString(args.channel)

    if (!nodeId || !title) {
      return { ok: false, message: 'create_task needs a node and title.' }
    }

    state.addTask({
      assignee: asString(args.assignee),
      channel: isTaskChannel(channel) ? channel : 'general',
      details: asString(args.details),
      due: asString(args.due),
      nodeId,
      title,
    })

    return { ok: true, message: `Created task: ${title}` }
  }

  if (name === 'create_doc') {
    const nodeId = asString(args.nodeId)
    const title = asString(args.title)

    if (!title) {
      return { ok: false, message: 'create_doc needs a title.' }
    }

    state.addDoc({
      body: asString(args.body),
      nodeId: getNode(state.nodes, nodeId) ? nodeId : undefined,
      title,
    })

    return { ok: true, message: `Created doc: ${title}` }
  }

  if (name === 'rename_flow') {
    const flowName = asString(args.name)
    if (!flowName) {
      return { ok: false, message: 'rename_flow needs a name.' }
    }

    state.setFlowName(flowName)

    return { ok: true, message: `Renamed flow: ${flowName}` }
  }

  if (name === 'set_line_mode') {
    const mode = asString(args.mode)
    if (!isEdgeLineMode(mode)) {
      return { ok: false, message: 'set_line_mode needs curved or straight.' }
    }

    state.setEdgeLineMode(mode)

    return { ok: true, message: `Line mode set to ${mode}.` }
  }

  return {
    ok: false,
    message: `Unknown tool: ${name || 'unnamed tool'}.`,
  }
}
