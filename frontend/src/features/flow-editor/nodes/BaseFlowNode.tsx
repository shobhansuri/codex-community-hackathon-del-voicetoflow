import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from '@xyflow/react'
import type { FlowNode } from '../canvas/flowTypes'
import { DocIcon } from '../docs/DocModal'
import { useFlowEditorStore } from '../state/flowEditorStore'
import { isTaskOverdue } from '../tasks/taskDue'

type EditableTextProps = {
  buttonClassName?: string
  className: string
  emptyLabel: string
  startEditingWhenEmpty?: boolean
  multiline?: boolean
  onSave: (value: string) => void
  value: string
}

function EditableText({
  buttonClassName,
  className,
  emptyLabel,
  startEditingWhenEmpty = false,
  multiline = false,
  onSave,
  value,
}: EditableTextProps) {
  const [draft, setDraft] = useState(value)
  const [isEditing, setIsEditing] = useState(startEditingWhenEmpty && !value)

  useEffect(() => {
    if (!isEditing) {
      setDraft(value)
    }
  }, [isEditing, value])

  function startEditing() {
    setDraft(value)
    setIsEditing(true)
  }

  function commit() {
    const nextValue = draft.trim()
    onSave(nextValue)
    setDraft(nextValue)
    setIsEditing(false)
  }

  function cancel() {
    setDraft(value)
    setIsEditing(false)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
      return
    }

    if (event.key === 'Enter' && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit()
    }
  }

  if (isEditing) {
    const inputClass =
      `nodrag nowheel w-full rounded-md border border-transparent bg-transparent px-1 py-0 outline-none focus:border-transparent focus:bg-transparent focus:ring-0 ${className}`

    if (multiline) {
      return (
        <textarea
          autoFocus
          className={`${inputClass} min-h-16 resize-none`}
          onBlur={commit}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          value={draft}
        />
      )
    }

    return (
      <input
        autoFocus
        className={inputClass}
        onBlur={commit}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        value={draft}
      />
    )
  }

  return (
    <button
      className={`nodrag w-full rounded-md focus:outline-none ${buttonClassName ?? 'hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-600'} ${className} ${
        value ? '' : 'text-zinc-400'
      }`}
      onClick={(event) => {
        event.stopPropagation()
        startEditing()
      }}
      onDoubleClick={(event) => {
        event.stopPropagation()
        startEditing()
      }}
      type="button"
    >
      {value || emptyLabel}
    </button>
  )
}

function TaskStatusIcon({ done }: { done: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`grid size-4 place-items-center rounded-[4px] border ${
        done
          ? 'border-emerald-500 bg-emerald-500 text-white'
          : 'border-zinc-300 bg-white text-transparent'
      }`}
    >
      <svg
        className="size-2.5"
        fill="none"
        viewBox="0 0 12 12"
      >
        <path
          d="M2.75 6.25 5 8.5l4.25-4.75"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        />
      </svg>
    </div>
  )
}

const kindLabel: Record<FlowNode['data']['kind'], string> = {
  start: 'Kickoff',
  process: 'Process',
  decision: 'Decision',
  message: 'Message',
  note: 'Note',
  task: 'Task',
  wait: 'Wait',
  end: 'Outcome',
}

const kindTone: Record<
  FlowNode['data']['kind'],
  { avatar: string; dot: string }
> = {
  start: {
    avatar: 'bg-white/12 text-white',
    dot: 'bg-white/80',
  },
  process: {
    avatar: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100',
    dot: 'bg-blue-500',
  },
  decision: {
    avatar: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
    dot: 'bg-amber-500',
  },
  message: {
    avatar: 'bg-fuchsia-50 text-fuchsia-700 ring-1 ring-fuchsia-100',
    dot: 'bg-fuchsia-500',
  },
  note: {
    avatar: 'bg-amber-200/80 text-amber-950',
    dot: 'bg-amber-600',
  },
  task: {
    avatar: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
    dot: 'bg-emerald-500',
  },
  wait: {
    avatar: 'bg-orange-50 text-orange-700 ring-1 ring-orange-100',
    dot: 'bg-orange-500',
  },
  end: {
    avatar: 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200',
    dot: 'bg-zinc-500',
  },
}

function getInitials(label: string) {
  const clean = label.trim()
  if (!clean) {
    return 'WF'
  }

  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDueLabel(value: string) {
  if (!value) {
    return ''
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function getNotePreview(value: string) {
  return value.trim().replace(/\s+/g, ' ').slice(0, 96)
}

export function BaseFlowNode({ data, id, selected }: NodeProps<FlowNode>) {
  const updateNodeData = useFlowEditorStore((state) => state.updateNodeData)
  const docs = useFlowEditorStore((state) => state.docs)
  const tasks = useFlowEditorStore((state) => state.tasks)
  const updateTask = useFlowEditorStore((state) => state.updateTask)
  const updateNodeInternals = useUpdateNodeInternals()
  const handleClass =
    '!size-[11px] !border-2 !border-white !bg-zinc-400 shadow-[0_1px_4px_rgba(24,24,27,0.16)]'
  const selectedCardClass = selected
    ? 'ring-2 ring-blue-500/80 shadow-[0_14px_28px_-16px_rgba(37,99,235,0.5)]'
    : 'ring-1 ring-zinc-950/8 shadow-[0_18px_36px_-30px_rgba(24,24,27,0.55)]'
  const nodeTasks = useMemo(
    () => tasks.filter((task) => task.nodeId === id),
    [id, tasks],
  )
  const nodeDocs = useMemo(
    () => docs.filter((doc) => doc.nodeId === id),
    [docs, id],
  )
  const doneTaskCount = nodeTasks.filter((task) => task.status === 'done').length
  const previewTasks = nodeTasks.slice(0, 2)
  const previewDocs = nodeDocs.slice(0, 2)
  const previewNote = data.notes.find((note) => note.body.trim())
  const emptyStateMessage =
    nodeTasks.length === 0 && !previewNote
      ? 'No tasks or notes.'
      : nodeTasks.length === 0
        ? 'No tasks.'
        : !previewNote
          ? 'No note.'
          : ''
  const tone = kindTone[data.kind]
  const avatarLabel = getInitials(
    nodeTasks.find((task) => task.assignee)?.assignee || data.title,
  )
  const layoutSignature = useMemo(
    () =>
      JSON.stringify({
        docs: previewDocs.map((doc) => [doc.id, doc.title]),
        kind: data.kind,
        notes: data.notes.map((note) => [note.id, note.body]),
        selected,
        tasks: previewTasks.map((task) => [
          task.id,
          task.title,
          task.due,
          task.status,
        ]),
        title: data.title,
      }),
    [data.kind, data.notes, data.title, previewDocs, previewTasks, selected],
  )

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      updateNodeInternals(id)
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [id, layoutSignature, updateNodeInternals])

  if (data.kind === 'decision') {
    const decisionStroke = selected ? '#3B82F6' : '#D6A742'

    return (
      <div className="relative grid h-44 w-60 place-items-center">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_18px_28px_rgba(24,24,27,0.08)]"
          viewBox="0 0 280 208"
        >
          <path
            d="M140 6 274 104 140 202 6 104Z"
            fill="#FEF3C7"
            stroke={decisionStroke}
            strokeLinejoin="round"
            strokeWidth={selected ? 4 : 3}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        <Handle
          className={handleClass}
          id="target-top"
          position={Position.Top}
          type="target"
        />
        <Handle
          className={handleClass}
          id="source-left"
          position={Position.Left}
          type="source"
        />
        <Handle
          className={handleClass}
          id="source-right"
          position={Position.Right}
          type="source"
        />
        <Handle
          className={handleClass}
          id="source-bottom"
          position={Position.Bottom}
          type="source"
        />

        <div className="relative grid w-40 gap-2 justify-items-center text-center">
          <div className="grid justify-items-center gap-1">
            <p className="text-[0.72rem] font-medium text-amber-700">
              {kindLabel.decision}
            </p>
            <EditableText
              buttonClassName="hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-600"
              className="px-1 text-center text-[0.9375rem] font-semibold text-amber-950"
              emptyLabel="Decision"
              onSave={(title) => updateNodeData(id, { title: title || data.title })}
              value={data.title}
            />
          </div>
          {previewNote ? (
            <p className="max-w-32 text-center text-[0.75rem] text-amber-900/75">
              {getNotePreview(previewNote.body)}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  if (data.kind === 'start') {
    return (
      <div
        className={`relative min-w-[14rem] rounded-full bg-zinc-950 px-7 py-4 text-white ${selectedCardClass}`}
      >
        <Handle
          className={handleClass}
          id="target-top"
          position={Position.Top}
          type="target"
        />
        <Handle
          className={handleClass}
          id="source-bottom"
          position={Position.Bottom}
          type="source"
        />

        <div className="grid justify-items-center gap-1 text-center">
          <p className="text-[0.72rem] font-medium text-zinc-400">
            {kindLabel.start}
          </p>
          <EditableText
            buttonClassName="hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-white/70"
            className="px-1 text-center text-[1rem] font-semibold text-white"
            emptyLabel="Kickoff"
            onSave={(title) => updateNodeData(id, { title: title || data.title })}
            value={data.title}
          />
        </div>
      </div>
    )
  }

  if (data.kind === 'end') {
    return (
      <div
        className={`relative min-w-[14rem] rounded-full bg-white px-7 py-4 text-zinc-950 ${selectedCardClass}`}
      >
        <Handle
          className={handleClass}
          id="target-top"
          position={Position.Top}
          type="target"
        />
        <Handle
          className={handleClass}
          id="target-left"
          position={Position.Left}
          type="target"
        />

        <div className="grid justify-items-center gap-1 text-center">
          <p className="text-[0.72rem] font-medium text-zinc-500">
            {kindLabel.end}
          </p>
          <EditableText
            className="px-1 text-center text-[1rem] font-semibold text-zinc-950"
            emptyLabel="Outcome"
            onSave={(title) => updateNodeData(id, { title: title || data.title })}
            value={data.title}
          />
        </div>
      </div>
    )
  }

  if (data.kind === 'note') {
    return (
      <div
        className={`relative w-[17.5rem] bg-amber-100 p-4 text-amber-950 [clip-path:polygon(0_0,calc(100%-28px)_0,100%_28px,100%_100%,0_100%)] ${selectedCardClass}`}
      >
        <div className="pointer-events-none absolute right-0 top-0 size-7 border-b border-l border-amber-300 bg-amber-200" />
        <Handle
          className={handleClass}
          id="target-top"
          position={Position.Top}
          type="target"
        />
        <Handle
          className={handleClass}
          id="target-left"
          position={Position.Left}
          type="target"
        />
        <Handle
          className={handleClass}
          id="source-right"
          position={Position.Right}
          type="source"
        />
        <Handle
          className={handleClass}
          id="source-bottom"
          position={Position.Bottom}
          type="source"
        />

        <div className="grid gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="grid min-w-0 gap-1">
              <p className="text-[0.72rem] font-medium text-amber-800/70">
                {kindLabel.note}
              </p>
              <EditableText
                buttonClassName="hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-600"
                className="px-0 text-left text-[0.95rem] font-semibold text-amber-950"
                emptyLabel="Working note"
                onSave={(title) => updateNodeData(id, { title: title || data.title })}
                value={data.title}
              />
            </div>
            <div className={`grid size-8 shrink-0 place-items-center rounded-full text-[0.72rem] font-semibold ${tone.avatar}`}>
              {avatarLabel}
            </div>
          </div>
          {previewNote ? (
            <div className="rounded-lg bg-amber-50/90 px-3 py-2.5">
              <p className="text-sm/6 text-amber-950/80">
                {getNotePreview(previewNote.body)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-900/70">
              Capture loose context and decisions here.
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative w-[17.5rem] bg-white p-4 text-zinc-950 ${selectedCardClass}`}
    >
      <Handle
        className={handleClass}
        id="target-top"
        position={Position.Top}
        type="target"
      />
      <Handle
        className={handleClass}
        id="target-left"
        position={Position.Left}
        type="target"
      />
      <Handle
        className={handleClass}
        id="source-right"
        position={Position.Right}
        type="source"
      />
      <Handle
        className={handleClass}
        id="source-bottom"
        position={Position.Bottom}
        type="source"
      />

      <div className="grid gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="grid min-w-0 gap-1">
            <div className="flex items-center gap-2">
              <div className={`size-2 rounded-full ${tone.dot}`} />
              <p className="text-[0.72rem] font-medium text-zinc-500">
                {kindLabel[data.kind]}
              </p>
            </div>
            <EditableText
              className="px-0 text-left text-[0.95rem] font-semibold text-zinc-950"
              emptyLabel="Name this node"
              onSave={(title) => updateNodeData(id, { title: title || data.title })}
              value={data.title}
            />
          </div>
          <div className={`grid size-8 shrink-0 place-items-center rounded-full text-[0.72rem] font-semibold ${tone.avatar}`}>
            {avatarLabel}
          </div>
        </div>

        {nodeTasks.length > 0 ? (
          <div className="grid gap-2 border-t border-zinc-950/8 pt-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.72rem] font-medium text-zinc-500">
                Tasks
              </p>
              <p className="text-[0.72rem] font-medium tabular-nums text-zinc-400">
                {doneTaskCount}/{nodeTasks.length}
              </p>
            </div>
            <div className="grid gap-2">
              {previewTasks.map((task) => (
                <div
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
                  key={task.id}
                >
                  <button
                    aria-label={
                      task.status === 'done'
                        ? `Mark ${task.title} as todo`
                        : `Mark ${task.title} as done`
                    }
                    className="nodrag rounded-[6px] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    onClick={(event) => {
                      event.stopPropagation()
                      updateTask(task.id, {
                        status: task.status === 'done' ? 'todo' : 'done',
                      })
                    }}
                    type="button"
                  >
                    <TaskStatusIcon done={task.status === 'done'} />
                  </button>
                  <p
                    className={`truncate text-[0.875rem] ${
                      task.status === 'done'
                        ? 'text-zinc-400 line-through'
                        : isTaskOverdue(task)
                          ? 'text-red-700'
                        : 'text-zinc-700'
                    }`}
                  >
                    {task.title}
                  </p>
                  <p
                    className={`text-[0.72rem] font-medium tabular-nums ${
                      isTaskOverdue(task)
                        ? 'text-red-600'
                        : task.status === 'done'
                          ? 'text-zinc-300'
                          : 'text-zinc-400'
                    }`}
                  >
                    {formatDueLabel(task.due)}
                  </p>
                </div>
              ))}
              {nodeTasks.length > previewTasks.length ? (
                <p className="text-[0.75rem] text-zinc-400">
                  +{nodeTasks.length - previewTasks.length} more
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {previewNote ? (
          <div className="grid gap-2 border-t border-zinc-950/8 pt-3">
            <p className="text-[0.72rem] font-medium text-zinc-500">
              Note
            </p>
            <div className="rounded-lg bg-amber-50 px-3 py-2.5">
              <p className="text-sm/6 text-amber-950/80">
                {getNotePreview(previewNote.body)}
              </p>
            </div>
          </div>
        ) : null}

        {emptyStateMessage ? (
          <div className="grid gap-2 border-t border-zinc-950/8 pt-3">
            <p className="text-[0.8125rem] text-zinc-400">{emptyStateMessage}</p>
          </div>
        ) : null}

        {previewDocs.length > 0 ? (
          <div className="grid gap-2 border-t border-zinc-950/8 pt-3">
            <p className="text-[0.72rem] font-medium text-zinc-500">
              Docs
            </p>
            <div className="grid gap-1.5">
              {previewDocs.map((doc) => (
                <div
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 ring-1 ring-emerald-100"
                  key={doc.id}
                >
                  <DocIcon className="size-4 shrink-0" />
                  <p className="truncate text-[0.875rem] font-medium">
                    {doc.title}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
