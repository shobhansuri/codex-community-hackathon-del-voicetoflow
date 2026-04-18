import { useEffect, useMemo, useState } from 'react'
import type { FlowDoc, FlowNode } from '../canvas/flowTypes'

export function DocIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M4 2.75h5.75L12 5v8.25H4z"
        fill="currentColor"
        opacity=".14"
      />
      <path
        d="M4 2.75h5.75L12 5v8.25H4zM9.75 2.75V5H12M5.75 7.25h4.5M5.75 9.5h4.5M5.75 11.75h2.75"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type DocModalProps = {
  doc?: FlowDoc
  initialNodeId?: string
  nodes: FlowNode[]
  onClose: () => void
  onDelete?: (docId: string) => void
  onSave: (doc: {
    body: string
    nodeId?: string
    title: string
  }) => void
}

export function DocModal({
  doc,
  initialNodeId,
  nodes,
  onClose,
  onDelete,
  onSave,
}: DocModalProps) {
  const [title, setTitle] = useState(doc?.title ?? '')
  const [body, setBody] = useState(doc?.body ?? '')
  const [nodeId, setNodeId] = useState(doc?.nodeId ?? initialNodeId ?? '')
  const titleId = useMemo(
    () => `doc-modal-title-${doc?.id ?? 'new'}`,
    [doc?.id],
  )

  useEffect(() => {
    setTitle(doc?.title ?? '')
    setBody(doc?.body ?? '')
    setNodeId(doc?.nodeId ?? initialNodeId ?? '')
  }, [doc, initialNodeId])

  function handleSave() {
    const nextTitle = title.trim()
    if (!nextTitle) {
      return
    }

    onSave({
      title: nextTitle,
      body,
      nodeId: nodeId || undefined,
    })
  }

  return (
    <div
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/25 p-4"
      role="dialog"
    >
      <div className="flex max-h-[min(48rem,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white ring-1 ring-zinc-950/10">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-950/10 p-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-md bg-zinc-50 text-zinc-700 ring-1 ring-zinc-950/10">
              <DocIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <h2
                className="text-base font-semibold text-zinc-950"
                id={titleId}
              >
                {doc ? 'Edit doc modal' : 'New doc modal'}
              </h2>
              <p className="text-sm text-zinc-500">
                Write details here. Attach it to a node only when needed.
              </p>
            </div>
          </div>
          <button
            className="rounded-md px-2 py-1 text-sm font-medium text-zinc-500 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-5">
          <label className="grid gap-1.5">
            <div className="text-sm font-medium text-zinc-800">Title</div>
            <input
              aria-label="Doc title"
              autoFocus
              className="w-full rounded-md border border-zinc-950/10 bg-white px-3 py-2 text-base font-semibold text-zinc-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              name="doc-title"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Doc title"
              type="text"
              value={title}
            />
          </label>

          <label className="grid gap-1.5">
            <div className="text-sm font-medium text-zinc-800">
              Attachment
            </div>
            <select
              aria-label="Attached node"
              className="w-full rounded-md border border-zinc-950/10 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              name="doc-node"
              onChange={(event) => setNodeId(event.target.value)}
              value={nodeId}
            >
              <option value="">No node attached</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.data.title || 'Untitled node'}
                </option>
              ))}
            </select>
          </label>

          <label className="grid min-h-0 gap-1.5">
            <div className="text-sm font-medium text-zinc-800">Doc body</div>
            <textarea
              aria-label="Doc body"
              className="min-h-80 w-full resize-y rounded-md border border-zinc-950/10 bg-white px-3 py-2 text-sm/6 text-zinc-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              name="doc-body"
              onChange={(event) => setBody(event.target.value)}
              placeholder="Add requirements, SOP, customer context, decisions, or handoff notes"
              value={body}
            />
          </label>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-950/10 p-5">
          {doc && onDelete ? (
            <button
              className="rounded-md px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
              onClick={() => onDelete(doc.id)}
              type="button"
            >
              Delete
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <button
              className="rounded-md px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              disabled={!title.trim()}
              onClick={handleSave}
              type="button"
            >
              {doc ? 'Save doc' : 'Create doc'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
