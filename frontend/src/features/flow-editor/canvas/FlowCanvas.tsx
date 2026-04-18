import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  useReactFlow,
  type NodeMouseHandler,
  type OnConnectEnd,
  type OnConnectStart,
  type XYPosition,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from '../nodes/nodeTypes'
import { NodeShapeIcon } from '../nodes/NodeShapeIcon'
import { paletteItems } from '../palette/paletteItems'
import { useFlowEditorStore } from '../state/flowEditorStore'
import type { EdgeLineMode, FlowNodeKind } from './flowTypes'

function isFlowNodeKind(value: string): value is FlowNodeKind {
  return [
    'start',
    'process',
    'decision',
    'message',
    'note',
    'task',
    'wait',
    'end',
  ].includes(value)
}

type ConnectMenuState = {
  screenPosition: XYPosition
  flowPosition: XYPosition
  sourceNodeId: string
  sourceHandle: string | null
  sourceScreenPosition: XYPosition
}

type ConnectionStartState = Pick<
  ConnectMenuState,
  'sourceNodeId' | 'sourceHandle' | 'sourceScreenPosition'
>

const connectMenuKindOrder: FlowNodeKind[] = [
  'process',
  'decision',
  'message',
  'task',
  'wait',
  'end',
  'note',
  'start',
]

const connectMenuItems = connectMenuKindOrder
  .map((kind) => paletteItems.find((item) => item.kind === kind))
  .filter((item): item is (typeof paletteItems)[number] => Boolean(item))

function getClientPoint(event: MouseEvent | TouchEvent): XYPosition | null {
  if ('changedTouches' in event) {
    const touch = event.changedTouches[0]
    return touch ? { x: touch.clientX, y: touch.clientY } : null
  }

  return { x: event.clientX, y: event.clientY }
}

function getEventElement(event: MouseEvent | TouchEvent): Element | null {
  return event.target instanceof Element ? event.target : null
}

function getElementCenter(element: Element, container: Element): XYPosition {
  const elementRect = element.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()

  return {
    x: elementRect.left + elementRect.width / 2 - containerRect.left,
    y: elementRect.top + elementRect.height / 2 - containerRect.top,
  }
}

function getPendingPath(
  source: XYPosition,
  target: XYPosition,
  edgeLineMode: EdgeLineMode,
  sourceHandle: string | null,
) {
  if (edgeLineMode === 'straight') {
    return `M ${source.x} ${source.y} L ${target.x} ${target.y}`
  }

  if (sourceHandle === 'source-bottom') {
    const dy = Math.max(60, Math.abs(target.y - source.y) * 0.45)

    return `M ${source.x} ${source.y} C ${source.x} ${source.y + dy}, ${target.x} ${target.y - dy}, ${target.x} ${target.y}`
  }

  if (sourceHandle === 'source-left') {
    const dx = Math.max(80, Math.abs(target.x - source.x) * 0.45)

    return `M ${source.x} ${source.y} C ${source.x - dx} ${source.y}, ${target.x} ${target.y - dx}, ${target.x} ${target.y}`
  }

  const dx = Math.max(80, Math.abs(target.x - source.x) * 0.45)

  return `M ${source.x} ${source.y} C ${source.x + dx} ${source.y}, ${target.x - dx} ${target.y}, ${target.x} ${target.y}`
}

export function FlowCanvas() {
  const { screenToFlowPosition } = useReactFlow()
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const connectMenuRef = useRef<HTMLDivElement | null>(null)
  const connectionStartRef = useRef<ConnectionStartState | null>(null)
  const [connectMenu, setConnectMenu] = useState<ConnectMenuState | null>(null)
  const nodes = useFlowEditorStore((state) => state.nodes)
  const edges = useFlowEditorStore((state) => state.edges)
  const edgeLineMode = useFlowEditorStore(
    (state) => state.settings.edgeLineMode,
  )
  const addNode = useFlowEditorStore((state) => state.addNode)
  const addConnectedNode = useFlowEditorStore((state) => state.addConnectedNode)
  const onNodesChange = useFlowEditorStore((state) => state.onNodesChange)
  const onEdgesChange = useFlowEditorStore((state) => state.onEdgesChange)
  const onConnect = useFlowEditorStore((state) => state.onConnect)
  const setSelectedNodeId = useFlowEditorStore((state) => state.setSelectedNodeId)

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    setConnectMenu(null)
    setSelectedNodeId(node.id)
  }

  useEffect(() => {
    if (!connectMenu) {
      return
    }

    function cancelPendingConnection(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        connectMenuRef.current?.contains(event.target)
      ) {
        return
      }

      connectionStartRef.current = null
      setConnectMenu(null)
    }

    function cancelPendingConnectionWithEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') {
        return
      }

      connectionStartRef.current = null
      setConnectMenu(null)
    }

    document.addEventListener('pointerdown', cancelPendingConnection)
    document.addEventListener('keydown', cancelPendingConnectionWithEscape)

    return () => {
      document.removeEventListener('pointerdown', cancelPendingConnection)
      document.removeEventListener('keydown', cancelPendingConnectionWithEscape)
    }
  }, [connectMenu])

  const handleConnectStart: OnConnectStart = (_, params) => {
    const handleElement = getEventElement(_)?.closest('.react-flow__handle')
    const sourceScreenPosition =
      handleElement && canvasRef.current
        ? getElementCenter(handleElement, canvasRef.current)
        : null
    connectionStartRef.current = params.nodeId
      ? {
          sourceNodeId: params.nodeId,
          sourceHandle: params.handleId,
          sourceScreenPosition: sourceScreenPosition ?? { x: 0, y: 0 },
        }
      : null
    setConnectMenu(null)
  }

  const handleConnectEnd: OnConnectEnd = (event, connectionState) => {
    if (connectionState.toNode) {
      connectionStartRef.current = null
      setConnectMenu(null)
      return
    }

    const source = connectionStartRef.current
    const point = getClientPoint(event)
    connectionStartRef.current = null

    if (!source || !point) {
      return
    }

    const rect = canvasRef.current?.getBoundingClientRect()
    const screenPosition = rect
      ? { x: point.x - rect.left, y: point.y - rect.top }
      : point

    setConnectMenu({
      ...source,
      screenPosition,
      flowPosition: screenToFlowPosition(point),
    })
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setConnectMenu(null)

    const kind = event.dataTransfer.getData('application/voicetoflow-node-kind')
    if (!isFlowNodeKind(kind)) {
      return
    }

    addNode(
      kind,
      screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }),
    )
  }

  function handleAddConnectedNode(
    event: ReactMouseEvent<HTMLButtonElement>,
    kind: FlowNodeKind,
  ) {
    event.stopPropagation()
    if (!connectMenu) {
      return
    }

    addConnectedNode(
      kind,
      connectMenu.flowPosition,
      connectMenu.sourceNodeId,
      connectMenu.sourceHandle,
    )
    setConnectMenu(null)
  }

  return (
    <div
      className="relative h-full min-w-0 flex-1 bg-[oklch(0.986_0.003_240)]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      ref={canvasRef}
    >
      <ReactFlow
        edges={edges}
        fitView
        nodeTypes={nodeTypes}
        nodes={nodes}
        onConnect={onConnect}
        onConnectEnd={handleConnectEnd}
        onConnectStart={handleConnectStart}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodesChange={onNodesChange}
        onPaneClick={() => {
          connectionStartRef.current = null
          setConnectMenu(null)
          setSelectedNodeId(null)
        }}
      >
        <Background
          color="#d4d4d8"
          gap={22}
          size={1.35}
          variant={BackgroundVariant.Dots}
        />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>

      {connectMenu ? (
        <>
          <svg
            className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible"
            role="presentation"
          >
            <defs>
              <marker
                id="pending-connection-arrow"
                markerHeight="12"
                markerWidth="12"
                orient="auto-start-reverse"
                refX="10"
                refY="6"
                viewBox="0 0 12 12"
              >
                <path d="M2 2 L10 6 L2 10 Z" fill="#2563eb" />
              </marker>
            </defs>
            <path
              d={getPendingPath(
                connectMenu.sourceScreenPosition,
                connectMenu.screenPosition,
                edgeLineMode,
                connectMenu.sourceHandle,
              )}
              fill="none"
              markerEnd="url(#pending-connection-arrow)"
              stroke="#2563eb"
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </svg>
          <div
            className="absolute z-20 w-[28rem] max-w-[calc(100%-2rem)] rounded-lg bg-white p-2 shadow-[0_24px_48px_-28px_rgba(24,24,27,0.45)] ring-1 ring-zinc-950/8"
            ref={connectMenuRef}
            style={{
              left: connectMenu.screenPosition.x,
              top: connectMenu.screenPosition.y,
            }}
          >
            <p className="px-2 py-1 text-sm font-medium text-zinc-500">
              Choose next node
            </p>
            <div className="grid grid-cols-4 gap-1">
              {connectMenuItems.map((item) => (
                <button
                  className="relative grid min-h-20 place-items-center gap-1 rounded-lg p-2 text-center transition hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  key={item.kind}
                  onClick={(event) => handleAddConnectedNode(event, item.kind)}
                  type="button"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2"
                  />
                  <div className="grid size-9 place-items-center rounded-md bg-zinc-100 text-zinc-700 ring-1 ring-zinc-950/10">
                    <NodeShapeIcon className="size-7" kind={item.kind} />
                  </div>
                  <div className="text-sm font-medium text-zinc-900">
                    {item.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
