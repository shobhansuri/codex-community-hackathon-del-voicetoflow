import { useMemo, useState } from 'react'
import type { FlowDoc } from '../canvas/flowTypes'
import { useFlowEditorStore } from '../state/flowEditorStore'
import { DocIcon, DocModal } from './DocModal'

type DocsWorkspaceProps = {
  onOpenNode: () => void
}

export function DocsWorkspace({ onOpenNode }: DocsWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [nodeFilter, setNodeFilter] = useState('')
  const [activeDoc, setActiveDoc] = useState<FlowDoc | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const docs = useFlowEditorStore((state) => state.docs)
  const nodes = useFlowEditorStore((state) => state.nodes)
  const addDoc = useFlowEditorStore((state) => state.addDoc)
  const updateDoc = useFlowEditorStore((state) => state.updateDoc)
  const deleteDoc = useFlowEditorStore((state) => state.deleteDoc)
  const setSelectedNodeId = useFlowEditorStore((state) => state.setSelectedNodeId)
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  )
  const filteredDocs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return docs.filter((doc) => {
      const matchesSearch =
        !normalizedSearch ||
        `${doc.title} ${doc.body}`.toLowerCase().includes(normalizedSearch)
      const matchesNode =
        !nodeFilter ||
        (nodeFilter === '__none__' ? !doc.nodeId : doc.nodeId === nodeFilter)

      return matchesSearch && matchesNode
    })
  }, [docs, nodeFilter, search])

  function handleOpenNode(nodeId: string) {
    setSelectedNodeId(nodeId)
    onOpenNode()
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-white">
      <div className="mx-auto grid w-full max-w-6xl gap-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950">
              Doc modals
            </h1>
            <p className="mt-1 max-w-[64ch] text-sm/6 text-zinc-600">
              Keep longer flow context here. A doc can stand alone or attach to
              one node.
            </p>
          </div>
          <button
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            onClick={() => setIsCreating(true)}
            type="button"
          >
            New doc modal
          </button>
        </div>

        <div className="grid gap-3 border-y border-zinc-950/10 py-4 sm:grid-cols-[1fr_16rem]">
          <input
            aria-label="Search doc modals"
            className="w-full rounded-md border border-zinc-950/10 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            name="doc-search"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search docs"
            type="search"
            value={search}
          />
          <select
            aria-label="Filter by attached node"
            className="w-full rounded-md border border-zinc-950/10 bg-white px-3 py-2 text-sm text-zinc-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            name="doc-node-filter"
            onChange={(event) => setNodeFilter(event.target.value)}
            value={nodeFilter}
          >
            <option value="">All attachments</option>
            <option value="__none__">
              Attached to no node
            </option>
            {nodes.map((node) => (
              <option key={node.id} value={node.id}>
                {node.data.title || 'Untitled node'}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-hidden rounded-md ring-1 ring-zinc-950/10">
          {docs.length === 0 ? (
            <div className="grid place-items-center gap-3 p-12 text-center">
              <div className="grid size-12 place-items-center rounded-md bg-zinc-50 text-zinc-500 ring-1 ring-zinc-950/10">
                <DocIcon className="size-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-950">
                  No doc modals yet
                </p>
                <p className="mt-1 text-sm text-zinc-600">
                  Create one for requirements, handoff details, or node context.
                </p>
              </div>
              <button
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                onClick={() => setIsCreating(true)}
                type="button"
              >
                New doc modal
              </button>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm font-semibold text-zinc-950">
                No matching doc modals
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                Change the search or attachment filter.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-950/10">
              {filteredDocs.map((doc) => {
                const linkedNode = doc.nodeId
                  ? nodeById.get(doc.nodeId)
                  : undefined

                return (
                  <div
                    className="grid gap-3 bg-white p-4 hover:bg-zinc-50 sm:grid-cols-[1fr_auto]"
                    key={doc.id}
                  >
                    <button
                      className="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      onClick={() => setActiveDoc(doc)}
                      type="button"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <DocIcon className="size-4 shrink-0 text-zinc-500" />
                        <p className="truncate text-sm font-semibold text-zinc-950">
                          {doc.title}
                        </p>
                      </div>
                      <p className="mt-1 line-clamp-2 max-w-[72ch] text-sm/6 text-zinc-600">
                        {doc.body || 'No body yet.'}
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {linkedNode ? (
                        <button
                          className="rounded-md bg-zinc-100 px-2 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          onClick={() => handleOpenNode(linkedNode.id)}
                          type="button"
                        >
                          {linkedNode.data.title || 'Untitled node'}
                        </button>
                      ) : (
                        <div className="rounded-md bg-zinc-50 px-2 py-1 text-sm font-medium text-zinc-500 ring-1 ring-zinc-950/10">
                          No node
                        </div>
                      )}
                      <button
                        className="rounded-md px-2 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        onClick={() => setActiveDoc(doc)}
                        type="button"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {isCreating ? (
        <DocModal
          nodes={nodes}
          onClose={() => setIsCreating(false)}
          onSave={(doc) => {
            addDoc(doc)
            setIsCreating(false)
          }}
        />
      ) : null}

      {activeDoc ? (
        <DocModal
          doc={activeDoc}
          nodes={nodes}
          onClose={() => setActiveDoc(null)}
          onDelete={(docId) => {
            deleteDoc(docId)
            setActiveDoc(null)
          }}
          onSave={(doc) => {
            updateDoc(activeDoc.id, doc)
            setActiveDoc(null)
          }}
        />
      ) : null}
    </div>
  )
}
