import type { DragEvent } from 'react'
import { Link } from 'react-router-dom'
import { useFlowEditorStore } from '../state/flowEditorStore'
import { NodeShapeIcon } from '../nodes/NodeShapeIcon'
import { paletteItems } from './paletteItems'
import type { FlowNodeKind } from '../canvas/flowTypes'

const paletteTone = {
  start: 'bg-zinc-950 text-white',
  process: 'bg-white text-zinc-700',
  decision: 'bg-amber-50 text-amber-800',
  message: 'bg-fuchsia-50 text-fuchsia-700',
  note: 'bg-amber-100 text-amber-900',
  task: 'bg-emerald-50 text-emerald-700',
  wait: 'bg-orange-50 text-orange-700',
  end: 'bg-white text-zinc-700',
}

type NodePaletteProps = {
  isCanvasActive: boolean
  onOpenFlowchart: () => void
}

export function NodePalette({
  isCanvasActive,
  onOpenFlowchart,
}: NodePaletteProps) {
  const addNode = useFlowEditorStore((state) => state.addNode)

  function handleDragStart(event: DragEvent<HTMLButtonElement>, kind: FlowNodeKind) {
    if (!isCanvasActive) {
      event.preventDefault()
      return
    }

    event.dataTransfer.setData('application/voicetoflow-node-kind', kind)
    event.dataTransfer.effectAllowed = 'move'
  }

  function handleAddNode(kind: FlowNodeKind) {
    addNode(kind)

    if (!isCanvasActive) {
      onOpenFlowchart()
    }
  }

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col items-center border-r border-zinc-950/8 bg-white/94 py-3 backdrop-blur-md">
      <div className="pb-3">
        <Link
          aria-label="Back to flows"
          className="grid size-10 place-items-center rounded-lg bg-zinc-950 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          to="/flows"
          title="VoiceToFlow"
        >
          om
        </Link>
      </div>

      <div
        aria-label="Node library"
        className="grid flex-1 content-start gap-2 overflow-auto px-2"
        role="list"
      >
        {paletteItems.map((item) => (
          <button
            aria-label={`Add ${item.label}`}
            className={`relative grid size-10 place-items-center rounded-lg transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
              item.kind === 'note' ? 'bg-amber-100 hover:bg-amber-200' : 'bg-white'
            }`}
            draggable={isCanvasActive}
            key={item.kind}
            onClick={() => handleAddNode(item.kind)}
            onDragStart={(event) => handleDragStart(event, item.kind)}
            role="listitem"
            title={isCanvasActive ? item.label : `${item.label} and open flowchart`}
            type="button"
          >
            <span
              aria-hidden="true"
              className="pointer-fine:hidden absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2"
            />
            <div
              className={`grid size-8 place-items-center rounded-md ${paletteTone[item.kind]}`}
            >
              <NodeShapeIcon className="size-6" kind={item.kind} />
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}
