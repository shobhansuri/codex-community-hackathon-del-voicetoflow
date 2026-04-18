import { useMemo, useState } from 'react'
import type { TaskChannel, TaskStatus } from '../canvas/flowTypes'
import { useFlowEditorStore } from '../state/flowEditorStore'
import { isTaskOverdue } from './taskDue'

const channelLabels: Record<TaskChannel, string> = {
  general: 'General',
  whatsapp: 'WhatsApp',
  call: 'Call',
  email: 'Email',
}

const statusLabels: Record<TaskStatus, string> = {
  todo: 'Todo',
  in_progress: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

const statusControlTone: Record<TaskStatus, string> = {
  todo: 'bg-zinc-100 text-zinc-700 ring-zinc-950/8',
  in_progress: 'bg-blue-50 text-blue-700 ring-blue-200',
  done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200',
}

const fieldLabelClass = 'text-[0.72rem] font-medium text-zinc-500'
const controlClass =
  'w-full rounded-xl bg-white px-3 py-2.5 text-sm text-zinc-950 ring-1 ring-zinc-950/8 outline-none transition focus:ring-2 focus:ring-blue-200 max-sm:text-base'

type WorkflowTasksTableProps = {
  onOpenNode: () => void
}

function SummaryStat({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:px-5">
      <p className="truncate text-[0.72rem] font-medium text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-zinc-950">{value}</p>
    </div>
  )
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function WorkflowTasksTable({ onOpenNode }: WorkflowTasksTableProps) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [channelFilter, setChannelFilter] = useState<'all' | TaskChannel>('all')
  const [nodeFilter, setNodeFilter] = useState('all')
  const nodes = useFlowEditorStore((state) => state.nodes)
  const tasks = useFlowEditorStore((state) => state.tasks)
  const setSelectedNodeId = useFlowEditorStore((state) => state.setSelectedNodeId)
  const updateTask = useFlowEditorStore((state) => state.updateTask)

  const nodeTitleById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.title])),
    [nodes],
  )

  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((task) => task.assignee).filter(Boolean)),
      ).sort(),
    [tasks],
  )

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return tasks.filter((task) => {
      const nodeTitle = nodeTitleById.get(task.nodeId) ?? 'Node'
      const searchable = [
        task.title,
        task.assignee,
        task.due,
        task.details,
        channelLabels[task.channel],
        statusLabels[task.status],
        nodeTitle,
      ]
        .join(' ')
        .toLowerCase()

      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
        (statusFilter === 'all' || task.status === statusFilter) &&
        (assigneeFilter === 'all' || task.assignee === assigneeFilter) &&
        (channelFilter === 'all' || task.channel === channelFilter) &&
        (nodeFilter === 'all' || task.nodeId === nodeFilter)
      )
    })
  }, [
    assigneeFilter,
    channelFilter,
    nodeFilter,
    nodeTitleById,
    query,
    statusFilter,
    tasks,
  ])

  const openTaskCount = tasks.filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled',
  ).length
  const doneTaskCount = tasks.filter((task) => task.status === 'done').length
  const hasActiveFilters =
    query.trim() ||
    statusFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    channelFilter !== 'all' ||
    nodeFilter !== 'all'

  function clearFilters() {
    setQuery('')
    setStatusFilter('all')
    setAssigneeFilter('all')
    setChannelFilter('all')
    setNodeFilter('all')
  }

  function openNode(nodeId: string) {
    setSelectedNodeId(nodeId)
    onOpenNode()
  }

  return (
    <section className="min-h-0 flex-1 overflow-auto bg-[oklch(0.985_0.002_240)]">
      <div className="mx-auto grid w-full max-w-[104rem] gap-6 p-6 lg:p-8">
        <header className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid gap-2">
            <div className="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-[0.72rem] font-medium text-zinc-600 ring-1 ring-zinc-950/8">
              Execution board
            </div>
            <div className="grid gap-1">
              <h1 className="max-w-[18ch] text-2xl font-semibold tracking-tight text-balance text-zinc-950">
                Workflow tasks
              </h1>
              <p className="max-w-[60ch] text-sm/6 text-pretty text-zinc-600">
                Track execution work created from notes and nodes.
              </p>
            </div>
          </div>

          <div className="grid overflow-hidden rounded-xl bg-white ring-1 ring-zinc-950/8 sm:grid-cols-3">
            <SummaryStat label="Total" value={tasks.length} />
            <div className="border-t border-zinc-950/8 sm:border-t-0 sm:border-l">
              <SummaryStat label="Open" value={openTaskCount} />
            </div>
            <div className="border-t border-zinc-950/8 sm:border-t-0 sm:border-l">
              <SummaryStat label="Done" value={doneTaskCount} />
            </div>
          </div>
        </header>

        <section className="rounded-xl bg-white p-4 ring-1 ring-zinc-950/8">
          <div className="grid gap-3 xl:grid-cols-[minmax(18rem,2fr)_10rem_10rem_10rem_12rem_auto]">
            <label className="grid gap-1.5">
              <p className={fieldLabelClass}>Search</p>
              <input
                className={controlClass}
                name="task-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, owner, node"
                type="search"
                value={query}
              />
            </label>

            <label className="grid gap-1.5">
              <p className={fieldLabelClass}>Status</p>
              <select
                className={controlClass}
                name="task-status-filter"
                onChange={(event) =>
                  setStatusFilter(event.target.value as 'all' | TaskStatus)
                }
                value={statusFilter}
              >
                <option value="all">All</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <p className={fieldLabelClass}>Owner</p>
              <select
                className={controlClass}
                name="task-assignee-filter"
                onChange={(event) => setAssigneeFilter(event.target.value)}
                value={assigneeFilter}
              >
                <option value="all">All</option>
                {assigneeOptions.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <p className={fieldLabelClass}>Channel</p>
              <select
                className={controlClass}
                name="task-channel-filter"
                onChange={(event) =>
                  setChannelFilter(event.target.value as 'all' | TaskChannel)
                }
                value={channelFilter}
              >
                <option value="all">All</option>
                {Object.entries(channelLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1.5">
              <p className={fieldLabelClass}>Node</p>
              <select
                className={controlClass}
                name="task-node-filter"
                onChange={(event) => setNodeFilter(event.target.value)}
                value={nodeFilter}
              >
                <option value="all">All</option>
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.data.title || 'Untitled node'}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button
                className="w-full rounded-xl bg-zinc-100 px-3 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                disabled={!hasActiveFilters}
                onClick={clearFilters}
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        </section>

        {tasks.length === 0 ? (
          <div className="grid place-items-center rounded-xl bg-white px-6 py-16 text-center ring-1 ring-zinc-950/8">
            <div className="grid max-w-sm gap-2">
              <p className="text-sm font-semibold text-zinc-950">No tasks yet</p>
              <p className="text-sm/6 text-zinc-600">
                Add a note on a node, then convert it into a task.
              </p>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="grid place-items-center rounded-xl bg-white px-6 py-16 text-center ring-1 ring-zinc-950/8">
            <div className="grid max-w-sm gap-2">
              <p className="text-sm font-semibold text-zinc-950">No matching tasks</p>
              <p className="text-sm/6 text-zinc-600">
                Clear filters or search for another task.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-3" role="list">
            {filteredTasks.map((task) => {
              const overdue = isTaskOverdue(task)
              const nodeTitle = nodeTitleById.get(task.nodeId) ?? 'Node'
              const ownerName = task.assignee || 'Unassigned'
              const ownerInitials = task.assignee ? getInitials(task.assignee) : 'NA'

              return (
                <article
                  className={`grid gap-4 rounded-xl p-4 ring-1 transition hover:ring-zinc-950/15 lg:grid-cols-[minmax(18rem,2.1fr)_minmax(10rem,1fr)_8rem_8rem_10rem_minmax(14rem,1.2fr)_auto] lg:items-start ${
                    overdue ? 'bg-red-50/50 ring-red-200' : 'bg-white ring-zinc-950/8'
                  }`}
                  key={task.id}
                  role="listitem"
                >
                  <div className="grid gap-2">
                    <p className={fieldLabelClass}>Task</p>
                    <div className="grid gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`min-w-0 text-sm font-semibold ${
                            task.status === 'done'
                              ? 'text-zinc-400 line-through'
                              : 'text-zinc-950'
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.sourceNoteId ? (
                          <div className="rounded-full bg-blue-50 px-2 py-1 text-[0.72rem] font-semibold text-blue-700">
                            Source note
                          </div>
                        ) : null}
                        {overdue ? (
                          <div className="rounded-full bg-red-50 px-2 py-1 text-[0.72rem] font-semibold text-red-700">
                            Overdue
                          </div>
                        ) : null}
                      </div>
                      {task.details ? (
                        <p className="max-w-[70ch] text-sm/6 text-pretty text-zinc-600">
                          {task.details}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <p className={fieldLabelClass}>Owner</p>
                    <div className="flex items-center gap-2">
                      <div className="grid size-8 place-items-center rounded-full bg-zinc-100 text-[0.72rem] font-semibold text-zinc-700 ring-1 ring-zinc-950/8">
                        {ownerInitials}
                      </div>
                      <p className="text-sm text-zinc-700">{ownerName}</p>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <p className={fieldLabelClass}>Due</p>
                    <p
                      className={`text-sm tabular-nums ${
                        overdue ? 'font-medium text-red-700' : 'text-zinc-700'
                      }`}
                    >
                      {task.due || '-'}
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <p className={fieldLabelClass}>Channel</p>
                    <div className="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-[0.72rem] font-medium text-zinc-600">
                      {channelLabels[task.channel]}
                    </div>
                  </div>

                  <label className="grid gap-2">
                    <p className={fieldLabelClass}>Status</p>
                    <select
                      aria-label="Task status"
                      className={`rounded-xl px-3 py-2 text-sm font-medium outline-none ring-1 transition focus:ring-2 focus:ring-blue-200 max-sm:text-base ${
                        overdue && task.status !== 'done'
                          ? 'bg-red-50 text-red-700 ring-red-200'
                          : statusControlTone[task.status]
                      }`}
                      name={`task-status-${task.id}`}
                      onChange={(event) =>
                        updateTask(task.id, {
                          status: event.target.value as TaskStatus,
                        })
                      }
                      value={task.status}
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-2">
                    <p className={fieldLabelClass}>Node</p>
                    <button
                      className="min-w-0 text-left text-sm font-medium text-zinc-700 transition hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      onClick={() => openNode(task.nodeId)}
                      type="button"
                    >
                      {nodeTitle}
                    </button>
                  </div>

                  <div className="flex items-start lg:justify-end">
                    <button
                      className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      onClick={() => openNode(task.nodeId)}
                      type="button"
                    >
                      Open
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
