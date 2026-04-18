import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createFlow, listFlows, type FlowSummary } from '../flow-editor/api/flowApi'

const flowTimestampFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const flowRelativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
})

function formatFlowTimestamp(timestamp: string) {
  return flowTimestampFormatter.format(new Date(timestamp))
}

function formatRelativeFlowTimestamp(timestamp: string) {
  const deltaMs = new Date(timestamp).getTime() - Date.now()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (Math.abs(deltaMs) < hour) {
    return flowRelativeTimeFormatter.format(
      Math.round(deltaMs / minute),
      'minute',
    )
  }

  if (Math.abs(deltaMs) < day) {
    return flowRelativeTimeFormatter.format(Math.round(deltaMs / hour), 'hour')
  }

  return flowRelativeTimeFormatter.format(Math.round(deltaMs / day), 'day')
}

function AppMark() {
  return (
    <div className="grid size-9 place-items-center rounded-lg bg-blue-600 text-white ring-1 ring-blue-600">
      <svg
        aria-hidden="true"
        className="size-4"
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="M4 11.5V4.5m8 7V4.5M4 11.5l4-3m4 3-4-3m-4-4 4 3 4-3"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 text-zinc-400"
      fill="none"
      viewBox="0 0 16 16"
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10.5 10.5L13 13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function StatBlock({
  detail,
  label,
  value,
}: {
  detail: string
  label: string
  value: string
}) {
  return (
    <div className="grid gap-1 px-4 py-4 sm:px-5">
      <p className="truncate text-[0.72rem] font-medium text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-zinc-950">{value}</p>
      <p className="text-sm text-zinc-500">{detail}</p>
    </div>
  )
}

function MetaPill({ children }: { children: string }) {
  return (
    <div className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-600 ring-1 ring-zinc-950/6">
      {children}
    </div>
  )
}

function EmptyState({
  body,
  title,
}: {
  body: string
  title: string
}) {
  return (
    <div className="grid place-items-center px-6 py-16 text-center">
      <div className="grid max-w-md gap-2">
        <p className="text-lg font-semibold text-zinc-950">{title}</p>
        <p className="text-base text-zinc-600">{body}</p>
      </div>
    </div>
  )
}

function FlowGlyph({ tone }: { tone: 'blue' | 'amber' | 'emerald' | 'violet' }) {
  const toneClass =
    tone === 'amber'
      ? 'bg-amber-50 text-amber-600 ring-amber-100'
      : tone === 'emerald'
        ? 'bg-emerald-50 text-emerald-600 ring-emerald-100'
        : tone === 'violet'
          ? 'bg-violet-50 text-violet-600 ring-violet-100'
          : 'bg-blue-50 text-blue-600 ring-blue-100'

  return (
    <div className={`grid size-12 place-items-center rounded-lg ring-1 ${toneClass}`}>
      <svg
        aria-hidden="true"
        className="size-5"
        fill="none"
        viewBox="0 0 20 20"
      >
        <circle cx="5" cy="14" fill="currentColor" r="1.75" />
        <circle cx="10" cy="6" fill="currentColor" r="1.75" />
        <circle cx="15" cy="11" fill="currentColor" r="1.75" />
        <path
          d="M6.5 12.9L8.8 7.3M11.8 7.4l1.7 2.2M6.7 13.2l6.6-1.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  )
}

function FlowListItem({
  flow,
  tone,
}: {
  flow: FlowSummary
  tone: 'blue' | 'amber' | 'emerald' | 'violet'
}) {
  return (
    <li className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:items-center">
      <FlowGlyph tone={tone} />

      <div className="min-w-0 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="truncate text-base font-semibold text-zinc-950 transition hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            to={`/flows/${flow.id}`}
          >
            {flow.name}
          </Link>
          <MetaPill>{formatRelativeFlowTimestamp(flow.updatedAt)}</MetaPill>
        </div>
        <p className="max-w-[70ch] text-base text-pretty text-zinc-600">
          {flow.description ||
            'Open the flow and add nodes, notes, and execution work.'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <MetaPill>
            {`${flow.nodeCount} ${flow.nodeCount === 1 ? 'node' : 'nodes'}`}
          </MetaPill>
          <MetaPill>
            {`${flow.edgeCount} ${flow.edgeCount === 1 ? 'link' : 'links'}`}
          </MetaPill>
        </div>
      </div>

      <div className="grid gap-1 text-left lg:text-right">
        <p className="text-[0.72rem] font-medium text-zinc-500">Last edit</p>
        <p className="text-sm font-medium tabular-nums text-zinc-950">
          {formatFlowTimestamp(flow.updatedAt)}
        </p>
      </div>

      <div className="flex items-center justify-start lg:justify-end">
        <Link
          className="inline-flex rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-800 ring-1 ring-black/5 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          to={`/flows/${flow.id}`}
        >
          Open
        </Link>
      </div>
    </li>
  )
}

export function FlowDashboardPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const flowsQuery = useQuery({
    queryKey: ['flows'],
    queryFn: listFlows,
  })

  const createFlowMutation = useMutation({
    mutationFn: createFlow,
    onSuccess: (flow) => {
      navigate(`/flows/${flow.id}`)
    },
  })

  const sortedFlows = useMemo(
    () =>
      [...(flowsQuery.data ?? [])].sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
      ),
    [flowsQuery.data],
  )

  const filteredFlows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    if (!normalizedQuery) {
      return sortedFlows
    }

    return sortedFlows.filter((flow) =>
      [flow.name, flow.description].join(' ').toLowerCase().includes(normalizedQuery),
    )
  }, [query, sortedFlows])

  const totalNodeCount = sortedFlows.reduce((sum, flow) => sum + flow.nodeCount, 0)
  const totalEdgeCount = sortedFlows.reduce((sum, flow) => sum + flow.edgeCount, 0)
  const latestFlow = sortedFlows[0]
  const tones: Array<'blue' | 'amber' | 'emerald' | 'violet'> = [
    'blue',
    'violet',
    'amber',
    'emerald',
  ]

  return (
    <main className="isolate min-h-dvh bg-[oklch(0.985_0.002_240)] text-zinc-950 antialiased">
      <header className="border-b border-zinc-950/8 bg-white/92 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <Link
            aria-label="Homepage"
            className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            to="/flows"
          >
            <AppMark />
            <div className="grid gap-0.5">
              <p className="text-sm font-semibold text-zinc-950">VoiceToFlow</p>
              <p className="text-sm text-zinc-500">Flows</p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:text-zinc-400"
              disabled={flowsQuery.isFetching}
              onClick={() => {
                void flowsQuery.refetch()
              }}
              type="button"
            >
              {flowsQuery.isFetching ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white ring-1 ring-blue-600 transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-blue-400"
              disabled={createFlowMutation.isPending}
              onClick={() => createFlowMutation.mutate()}
              type="button"
            >
              {createFlowMutation.isPending ? 'Creating...' : 'New flow'}
            </button>
          </div>
        </div>
      </header>

      <section className="py-8 sm:py-10">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-5 sm:px-6">
          <header className="grid gap-6">
            <div className="grid max-w-4xl gap-2">
              <p className="text-[0.72rem] font-medium text-blue-600">Flows</p>
              <div className="grid gap-2">
                <h1 className="max-w-[20ch] text-4xl font-semibold tracking-tight text-balance text-zinc-950 sm:text-5xl">
                  Pick up where you left off.
                </h1>
                <p className="max-w-[60ch] text-base text-pretty text-zinc-600">
                  Open a recent flow, start a new canvas, or search what changed.
                </p>
              </div>
            </div>

            <div className="grid overflow-hidden rounded-lg bg-white ring-1 ring-zinc-950/8 sm:grid-cols-3">
              <StatBlock
                detail={sortedFlows.length === 1 ? '1 saved workspace' : 'Saved workspaces'}
                label="Flows"
                value={String(sortedFlows.length)}
              />
              <div className="border-t border-zinc-950/8 sm:border-t-0 sm:border-l">
                <StatBlock
                  detail="Total nodes across all flows"
                  label="Nodes"
                  value={String(totalNodeCount)}
                />
              </div>
              <div className="border-t border-zinc-950/8 sm:border-t-0 sm:border-l">
                <StatBlock
                  detail={
                    latestFlow
                      ? formatRelativeFlowTimestamp(latestFlow.updatedAt)
                      : 'No recent edits'
                  }
                  label="Last edit"
                  value={latestFlow ? formatFlowTimestamp(latestFlow.updatedAt) : 'None'}
                />
              </div>
            </div>
          </header>

          <section className="rounded-lg bg-white p-3 ring-1 ring-zinc-950/8 sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
              <label className="flex items-center gap-3 rounded-lg bg-zinc-50 px-3 py-3 ring-1 ring-zinc-950/8 transition focus-within:bg-white focus-within:ring-blue-200">
                <SearchIcon />
                <input
                  className="min-w-0 flex-1 bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
                  name="flow-search"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search flows and descriptions"
                  type="search"
                  value={query}
                />
              </label>

              <div className="grid grid-cols-2 overflow-hidden rounded-lg bg-zinc-50 ring-1 ring-zinc-950/8 sm:min-w-[13rem]">
                <div className="grid gap-0.5 px-4 py-3">
                  <p className="text-[0.72rem] font-medium text-zinc-500">Visible</p>
                  <p className="text-lg font-semibold tabular-nums text-zinc-950">
                    {filteredFlows.length}
                  </p>
                </div>
                <div className="border-l border-zinc-950/8 px-4 py-3">
                  <p className="text-[0.72rem] font-medium text-zinc-500">Links</p>
                  <p className="text-lg font-semibold tabular-nums text-zinc-950">
                    {totalEdgeCount}
                  </p>
                </div>
              </div>

              {query.trim() ? (
                <button
                  className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  onClick={() => setQuery('')}
                  type="button"
                >
                  Clear search
                </button>
              ) : null}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg bg-white ring-1 ring-zinc-950/8">
            <div className="border-b border-zinc-950/8 px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="grid gap-1">
                  <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
                    Recent flows
                  </h2>
                  <p className="text-base text-zinc-600">
                    Sorted by latest activity.
                  </p>
                </div>
                <p className="text-sm tabular-nums text-zinc-500">
                  {filteredFlows.length} of {sortedFlows.length}
                </p>
              </div>
            </div>

            <div className="border-b border-zinc-950/8 bg-blue-50/40 px-5 py-4 sm:px-6">
              <button
                className="flex w-full flex-wrap items-center justify-between gap-4 text-left"
                disabled={createFlowMutation.isPending}
                onClick={() => createFlowMutation.mutate()}
                type="button"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-lg bg-white text-blue-600 ring-1 ring-blue-100">
                    <svg
                      aria-hidden="true"
                      className="size-5"
                      fill="none"
                      viewBox="0 0 16 16"
                    >
                      <path
                        d="M8 3.5v9m4.5-4.5h-9"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeWidth="1.5"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 grid gap-1">
                    <p className="text-base font-semibold text-zinc-950">
                      {createFlowMutation.isPending
                        ? 'Creating a blank flow'
                        : 'Start a new flow'}
                    </p>
                    <p className="text-base text-zinc-600">
                      Begin with an empty canvas and shape the flow from there.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-800 ring-1 ring-black/5">
                  New flow
                </div>
              </button>
            </div>

            {flowsQuery.isPending ? (
              <div className="px-5 py-10 text-base text-zinc-600 sm:px-6">
                Loading flows...
              </div>
            ) : null}

            {flowsQuery.isError ? (
              <div className="border-t border-zinc-950/8 px-5 py-6 sm:px-6">
                <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
                  Could not load saved flows. Check that Django and MySQL are running.
                </p>
              </div>
            ) : null}

            {!flowsQuery.isPending && !flowsQuery.isError && sortedFlows.length === 0 ? (
              <EmptyState
                body="Create your first flow and it will show up here."
                title="No flows yet"
              />
            ) : null}

            {!flowsQuery.isPending &&
            !flowsQuery.isError &&
            sortedFlows.length > 0 &&
            filteredFlows.length === 0 ? (
              <EmptyState
                body="Try another name or clear the current search."
                title="No matching flows"
              />
            ) : null}

            {!flowsQuery.isPending && !flowsQuery.isError && filteredFlows.length > 0 ? (
              <ul className="divide-y divide-zinc-950/5" role="list">
                {filteredFlows.map((flow, index) => (
                  <FlowListItem
                    flow={flow}
                    key={flow.id}
                    tone={tones[index % tones.length]}
                  />
                ))}
              </ul>
            ) : null}
          </section>

          {createFlowMutation.isError ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-200">
              Could not create a flow. Check that Django and MySQL are running.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  )
}
