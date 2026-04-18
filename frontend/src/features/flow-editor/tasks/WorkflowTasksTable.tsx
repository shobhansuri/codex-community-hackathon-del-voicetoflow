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
  in_progress: 'Doing',
  done: 'Done',
  cancelled: 'Cancelled',
}

const statusControlTone: Record<TaskStatus, string> = {
  todo: 'border-zinc-950/8 bg-zinc-50 text-zinc-600',
  in_progress: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  done: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  cancelled: 'border-rose-200 bg-rose-50 text-rose-700',
}

const filterLabelClass =
  'font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-zinc-400'

const baseControlClass =
  'h-11 w-full rounded-lg border border-zinc-950/8 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 max-sm:text-base'

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
    <div className="grid min-w-28 gap-1 px-6 py-3">
      <p className="truncate text-sm text-zinc-500">{label}</p>
      <p className="text-4xl font-semibold tracking-tight text-zinc-950">
        {value}
      </p>
    </div>
  )
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return initials || '--'
}

function formatDueLabel(due: string) {
  if (!due) {
    return 'No due date'
  }

  const parsed = new Date(due)

  if (Number.isNaN(parsed.getTime())) {
    return due
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
  }).format(parsed)
}

function ChannelBadge({ channel }: { channel: TaskChannel }) {
  if (channel === 'whatsapp') {
    return (
      <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
        <span className="size-1.5 rounded-full bg-emerald-500" />
        {channelLabels[channel]}
      </span>
    )
  }

  if (channel === 'call') {
    return (
      <span className="inline-flex items-center gap-2 rounded-md bg-amber-50 px-2.5 py-1 text-sm font-medium text-amber-700">
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          viewBox="0 0 16 16"
        >
          <path
            d="M4.5 2.5h2l1 3-1.5 1.5a9 9 0 0 0 3 3L10.5 8.5l3 1v2a1 1 0 0 1-1 1A10 10 0 0 1 2.5 3.5a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
        </svg>
        {channelLabels[channel]}
      </span>
    )
  }

  if (channel === 'email') {
    return (
      <span className="inline-flex items-center gap-2 rounded-md bg-sky-50 px-2.5 py-1 text-sm font-medium text-sky-700">
        <svg
          aria-hidden="true"
          className="size-3.5"
          fill="none"
          viewBox="0 0 16 16"
        >
          <rect
            height="9"
            rx="1.5"
            stroke="currentColor"
            strokeWidth="1.25"
            width="12"
            x="2"
            y="3.5"
          />
          <path
            d="m3 5 5 3.5L13 5"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.25"
          />
        </svg>
        {channelLabels[channel]}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-700">
      <span className="size-1.5 rounded-full bg-zinc-500" />
      {channelLabels[channel]}
    </span>
  )
}

function FilterSelect({
  name,
  onChange,
  options,
  value,
}: {
  name: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <div className="inline-grid grid-cols-[1fr_2rem] items-center">
      <select
        className={`${baseControlClass} col-span-full row-start-1 appearance-none pr-9`}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none col-start-2 row-start-1 mr-3 size-3.5 justify-self-end text-zinc-400"
        fill="none"
        viewBox="0 0 8 5"
      >
        <path
          d="M.75.75 4 4l3.25-3.25"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.25"
        />
      </svg>
    </div>
  )
}

function StatusSelect({
  name,
  onChange,
  status,
}: {
  name: string
  onChange: (value: TaskStatus) => void
  status: TaskStatus
}) {
  return (
    <div className="inline-grid min-w-28 grid-cols-[1fr_1.75rem] items-center">
      <select
        aria-label="Task status"
        className={`col-span-full row-start-1 h-10 appearance-none rounded-lg border px-3 pr-8 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 ${statusControlTone[status]}`}
        name={name}
        onChange={(event) => onChange(event.target.value as TaskStatus)}
        value={status}
      >
        {Object.entries(statusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none col-start-2 row-start-1 mr-2.5 size-3.5 justify-self-end"
        fill="none"
        viewBox="0 0 8 5"
      >
        <path
          d="M.75.75 4 4l3.25-3.25"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.25"
        />
      </svg>
    </div>
  )
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

  const statusOptions = [
    { label: 'All', value: 'all' },
    ...Object.entries(statusLabels).map(([value, label]) => ({
      label,
      value,
    })),
  ]
  const assigneeFilterOptions = [
    { label: 'All', value: 'all' },
    ...assigneeOptions.map((assignee) => ({ label: assignee, value: assignee })),
  ]
  const channelOptions = [
    { label: 'All', value: 'all' },
    ...Object.entries(channelLabels).map(([value, label]) => ({
      label,
      value,
    })),
  ]
  const nodeOptions = [
    { label: 'All', value: 'all' },
    ...nodes.map((node) => ({
      label: node.data.title || 'Untitled node',
      value: node.id,
    })),
  ]

  return (
    <section className="min-h-0 flex-1 overflow-auto bg-[oklch(0.992_0.002_240)]">
      <div className="mx-auto flex w-full max-w-[104rem] flex-col gap-6 px-6 py-7 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid gap-1">
            <h1 className="text-4xl font-semibold tracking-tight text-balance text-zinc-950">
              Workflow tasks
            </h1>
            <p className="max-w-[48ch] text-base text-pretty text-zinc-500">
              Track execution work created from notes and nodes.
            </p>
          </div>

          <div className="grid w-fit grid-cols-2 overflow-hidden rounded-lg border border-zinc-950/8 bg-white">
            <SummaryStat label="Total" value={tasks.length} />
            <div className="border-l border-zinc-950/8">
              <SummaryStat label="Open" value={openTaskCount} />
            </div>
          </div>
        </header>

        <section className="rounded-lg border border-zinc-950/8 bg-white p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(16rem,2.2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
            <label className="grid gap-1.5">
              <span className={filterLabelClass}>Search</span>
              <div className="relative">
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
                  fill="none"
                  viewBox="0 0 16 16"
                >
                  <circle
                    cx="7"
                    cy="7"
                    r="4.75"
                    stroke="currentColor"
                    strokeWidth="1.25"
                  />
                  <path
                    d="m10.5 10.5 3 3"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.25"
                  />
                </svg>
                <input
                  className={`${baseControlClass} pl-10`}
                  name="task-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Title, owner, node"
                  type="search"
                  value={query}
                />
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className={filterLabelClass}>Status</span>
              <FilterSelect
                name="task-status-filter"
                onChange={(value) => setStatusFilter(value as 'all' | TaskStatus)}
                options={statusOptions}
                value={statusFilter}
              />
            </label>

            <label className="grid gap-1.5">
              <span className={filterLabelClass}>Owner</span>
              <FilterSelect
                name="task-assignee-filter"
                onChange={setAssigneeFilter}
                options={assigneeFilterOptions}
                value={assigneeFilter}
              />
            </label>

            <label className="grid gap-1.5">
              <span className={filterLabelClass}>Channel</span>
              <FilterSelect
                name="task-channel-filter"
                onChange={(value) => setChannelFilter(value as 'all' | TaskChannel)}
                options={channelOptions}
                value={channelFilter}
              />
            </label>

            <label className="grid gap-1.5">
              <span className={filterLabelClass}>Node</span>
              <FilterSelect
                name="task-node-filter"
                onChange={setNodeFilter}
                options={nodeOptions}
                value={nodeFilter}
              />
            </label>

            <div className="flex items-end">
              <button
                className="h-11 w-full rounded-lg border border-zinc-950/8 bg-zinc-50 px-3 text-sm font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
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
          <div className="grid min-h-64 place-items-center rounded-lg border border-zinc-950/8 bg-white px-6 text-center">
            <div className="grid max-w-sm gap-2">
              <p className="text-base font-semibold text-zinc-950">No tasks yet</p>
              <p className="text-base text-pretty text-zinc-500">
                Add a note on a node, then convert it into a task.
              </p>
            </div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="grid min-h-64 place-items-center rounded-lg border border-zinc-950/8 bg-white px-6 text-center">
            <div className="grid max-w-sm gap-2">
              <p className="text-base font-semibold text-zinc-950">
                No matching tasks
              </p>
              <p className="text-base text-pretty text-zinc-500">
                Clear filters or search for another task.
              </p>
            </div>
          </div>
        ) : (
          <section className="overflow-hidden rounded-lg border border-zinc-950/8 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse">
                <thead>
                  <tr className="border-b border-zinc-950/8">
                    <th className="px-5 py-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-400">
                      Task
                    </th>
                    <th className="px-4 py-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-400">
                      Owner
                    </th>
                    <th className="px-4 py-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-400">
                      Due
                    </th>
                    <th className="px-4 py-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-400">
                      Channel
                    </th>
                    <th className="px-4 py-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-400">
                      Status
                    </th>
                    <th className="px-4 py-4 text-left font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-400">
                      Node
                    </th>
                    <th className="px-5 py-4 text-right font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] whitespace-nowrap text-zinc-400">
                      &nbsp;
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const overdue =
                      task.status !== 'done' &&
                      task.status !== 'cancelled' &&
                      isTaskOverdue(task)
                    const nodeTitle = nodeTitleById.get(task.nodeId) ?? 'Untitled node'
                    const ownerName = task.assignee || 'Unassigned'
                    const ownerInitials = getInitials(ownerName)

                    return (
                      <tr
                        className="border-b border-zinc-950/8 last:border-b-0 hover:bg-zinc-50/70"
                        key={task.id}
                      >
                        <td className="px-5 py-5 align-middle">
                          <div className="flex min-w-[18rem] flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <p
                                className={`text-[1.05rem] font-medium text-zinc-950 ${
                                  task.status === 'done' ? 'text-zinc-400 line-through' : ''
                                }`}
                              >
                                {task.title}
                              </p>
                              {task.sourceNoteId ? (
                                <span className="rounded-md bg-zinc-100 px-2 py-1 text-sm text-zinc-500">
                                  Note
                                </span>
                              ) : null}
                            </div>
                            {task.details ? (
                              <p className="max-w-[42ch] truncate text-sm text-zinc-500">
                                {task.details}
                              </p>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-5 align-middle">
                          <div className="flex min-w-40 items-center gap-2.5">
                            <div className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-500 text-[0.62rem] font-semibold tracking-[0.04em] text-white">
                              {ownerInitials}
                            </div>
                            <p className="truncate text-base text-zinc-700">{ownerName}</p>
                          </div>
                        </td>

                        <td className="px-4 py-5 align-middle">
                          <div className="grid min-w-20 gap-1">
                            <p
                              className={`text-base tabular-nums ${
                                overdue ? 'font-medium text-red-600' : 'text-zinc-700'
                              }`}
                            >
                              {formatDueLabel(task.due)}
                            </p>
                            {overdue ? (
                              <p className="text-sm font-medium text-red-500">Overdue</p>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-5 align-middle">
                          <div className="min-w-28">
                            <ChannelBadge channel={task.channel} />
                          </div>
                        </td>

                        <td className="px-4 py-5 align-middle">
                          <StatusSelect
                            name={`task-status-${task.id}`}
                            onChange={(value) => updateTask(task.id, { status: value })}
                            status={task.status}
                          />
                        </td>

                        <td className="px-4 py-5 align-middle">
                          <p className="min-w-56 text-base text-zinc-600">
                            {nodeTitle}
                          </p>
                        </td>

                        <td className="px-5 py-5 align-middle">
                          <div className="flex justify-end">
                            <button
                              className="rounded-lg border border-zinc-950/8 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                              onClick={() => openNode(task.nodeId)}
                              type="button"
                            >
                              Open node
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
