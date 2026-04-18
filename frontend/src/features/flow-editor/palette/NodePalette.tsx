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
    <aside className="flex h-full w-[6.75rem] shrink-0 flex-col border-r border-zinc-950/8 bg-white/92 backdrop-blur-md">
      <div className="border-b border-zinc-950/8 p-3">
        <Link
          aria-label="Back to flows"
          className="grid gap-2 rounded-xl bg-zinc-50 p-2.5 text-center ring-1 ring-zinc-950/8 transition hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          to="/flows"
          title="VoiceToFlow"
        >
          <div className="mx-auto grid size-10 place-items-center rounded-xl bg-zinc-950 text-sm font-semibold text-white">
            VF
          </div>
          <div className="grid gap-0.5">
            <p className="text-[0.68rem] font-medium text-zinc-500">Back to</p>
            <p className="text-sm font-semibold text-zinc-950">Flows</p>
          </div>
        </Link>
      </div>

      <div className="grid gap-2 px-3 pt-3">
        <div className="grid gap-0.5 px-1">
          <p className="text-[0.68rem] font-medium text-zinc-500">Canvas</p>
          <p className="text-sm font-semibold text-zinc-950">
            {isCanvasActive ? 'Add nodes' : 'Open flowchart'}
          </p>
        </div>
      </div>

      <div
        aria-label="Node library"
        className="grid flex-1 content-start gap-2 overflow-auto p-3"
        role="list"
      >
        {paletteItems.map((item) => (
          <button
            aria-label={`Add ${item.label}`}
            className="relative grid gap-2 rounded-xl bg-white p-2.5 text-center ring-1 ring-zinc-950/8 transition hover:translate-y-[-1px] hover:bg-zinc-50 hover:shadow-[0_16px_28px_-24px_rgba(24,24,27,0.45)] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
              className={`mx-auto grid size-10 place-items-center rounded-xl ring-1 ring-black/5 ${paletteTone[item.kind]}`}
            >
              <NodeShapeIcon className="size-7" kind={item.kind} />
            </div>
            <p className="text-[0.72rem] font-medium text-zinc-700">{item.label}</p>
          </button>
        ))}
      </div>

      <div className="border-t border-zinc-950/8 p-3">
        <p className="text-[0.72rem] text-zinc-500">
          {isCanvasActive ? 'Drag or click to add.' : 'Click a node to jump back.'}
        </p>
      </div>
    </aside>
  )
}
