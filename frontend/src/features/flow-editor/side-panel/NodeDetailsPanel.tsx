import { useMutation } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { extractTasksFromNote } from '../api/flowApi'
import type {
  FlowDoc,
  NodeNote,
  NodeTask,
  TaskChannel,
  TaskExtractionSuggestion,
  TaskStatus,
} from '../canvas/flowTypes'
import { DocIcon, DocModal } from '../docs/DocModal'
import { useFlowEditorStore } from '../state/flowEditorStore'
import { isTaskOverdue } from '../tasks/taskDue'

const fieldLabelClass =
  'text-[0.72rem] font-medium text-zinc-500'
const fieldInputClass =
  'w-full rounded-lg border border-zinc-950/8 bg-white px-3 py-2.5 text-sm text-zinc-950 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100'
const fieldTextAreaClass =
  'min-h-24 w-full resize-y rounded-lg border border-zinc-950/8 bg-white px-3 py-2.5 text-[0.9375rem]/7 text-zinc-900 shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)] outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100'
const ghostButtonClass =
  'rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
const secondaryButtonClass =
  'rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/8 transition hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
const primaryButtonClass =
  'rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50'
const surfaceCardClass =
  'rounded-lg bg-white ring-1 ring-zinc-950/8 shadow-[0_20px_34px_-28px_rgba(24,24,27,0.5)]'
const metaChipClass =
  'inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[0.72rem] font-semibold text-zinc-700'
const noteBodyClass = 'whitespace-pre-wrap break-words text-[0.95rem]/7 text-zinc-900'

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

type ComposerState =
  | {
      initialTitle: string
      sourceNoteId?: string
    }
  | null

type DraftTaskSuggestion = TaskExtractionSuggestion & {
  clientId: string
}

type NoteExtractionDraft = {
  existingTasks: NodeTask[]
  noteId: string
  suggestions: DraftTaskSuggestion[]
}

type ExtractionTrigger = 'note' | 'title'

type ExtractionDebugState = {
  errorMessage?: string
  message?: string
  mode: 'auto' | 'manual'
  noteId: string
  request: {
    allNotes: string[]
    existingTaskCount: number
    nodeId: string
    nodeTitle: string
    noteBody: string
    sourceLabel: string
    trigger: ExtractionTrigger
  }
  requestedAt: string
  response?: {
    createdCount: number
    suggestions: TaskExtractionSuggestion[]
  }
  status: 'calling' | 'error' | 'queued' | 'skipped' | 'success'
}

type ExtractTasksMutationPayload = {
  allNotes: string[]
  contentSignature?: string
  existingTasks: NodeTask[]
  mode?: 'auto' | 'manual'
  note: NodeNote
  sourceLabel?: string
  taskSourceNoteId?: string
  trigger?: ExtractionTrigger
}

const TITLE_AUTOMATION_NOTE_ID = '__node_title__'

function createDraftSuggestionId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeTaskText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function buildTaskMatcher(title: string, details = '') {
  const normalizedTitle = normalizeTaskText(title)
  const normalizedDetails = normalizeTaskText(details)
  const combined = [normalizedTitle, normalizedDetails].filter(Boolean).join(' ')
  const tokens = new Set(
    combined.split(' ').filter((token) => token.length > 1),
  )

  return {
    combined,
    details: normalizedDetails,
    primary: normalizedTitle || normalizedDetails,
    title: normalizedTitle,
    tokens,
  }
}

function textsOverlap(left: string, right: string) {
  if (!left || !right) {
    return false
  }

  const [shorter, longer] =
    left.length <= right.length ? [left, right] : [right, left]

  return shorter.length >= 12 && longer.includes(shorter)
}

function tasksLookSame(
  left: ReturnType<typeof buildTaskMatcher>,
  right: ReturnType<typeof buildTaskMatcher>,
) {
  if (left.primary && left.primary === right.primary) {
    return true
  }

  for (const [leftText, rightText] of [
    [left.combined, right.combined],
    [left.title, right.title],
    [left.details, right.details],
    [left.primary, right.combined],
    [left.combined, right.primary],
  ]) {
    if (textsOverlap(leftText, rightText)) {
      return true
    }
  }

  if (left.tokens.size >= 3 && Array.from(left.tokens).every((token) => right.tokens.has(token))) {
    return true
  }
  if (right.tokens.size >= 3 && Array.from(right.tokens).every((token) => left.tokens.has(token))) {
    return true
  }

  return false
}

type TaskComposerProps = {
  assigneeOptions: string[]
  initialTitle: string
  onCancel: () => void
  onCreate: (task: {
    assignee: string
    channel: TaskChannel
    details: string
    due: string
    title: string
  }) => void
}

function TaskComposer({
  assigneeOptions,
  initialTitle,
  onCancel,
  onCreate,
}: TaskComposerProps) {
  const [title, setTitle] = useState(initialTitle)
  const [assignee, setAssignee] = useState('')
  const [due, setDue] = useState('')
  const [channel, setChannel] = useState<TaskChannel>('general')
  const [details, setDetails] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  function handleCreate() {
    const nextTitle = title.trim()
    if (!nextTitle) {
      return
    }

    onCreate({
      assignee,
      channel,
      details,
      due,
      title: nextTitle,
    })
  }

  return (
    <div className={`grid gap-3 bg-[oklch(0.986_0.004_240)] p-3.5 ${surfaceCardClass}`}>
      <input
        aria-label="Task title"
        autoFocus
        className={`${fieldInputClass} font-medium`}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What needs to happen?"
        value={title}
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <div className={fieldLabelClass}>Owner</div>
          <input
            aria-label="Assignee"
            className={fieldInputClass}
            list="flow-task-assignees"
            name="task-assignee"
            onChange={(event) => setAssignee(event.target.value)}
            placeholder="@name"
            value={assignee}
          />
          <datalist id="flow-task-assignees">
            {assigneeOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1">
          <div className={fieldLabelClass}>Due date</div>
          <input
            aria-label="Due date"
            className={fieldInputClass}
            name="task-due"
            onChange={(event) => setDue(event.target.value)}
            type="date"
            value={due}
          />
        </label>
      </div>
      <label className="grid gap-1">
        <div className={fieldLabelClass}>Channel</div>
        <select
          aria-label="Task channel"
          className={fieldInputClass}
          name="task-channel"
          onChange={(event) => setChannel(event.target.value as TaskChannel)}
          value={channel}
        >
          {Object.entries(channelLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {showDetails ? (
        <textarea
          aria-label="Task details"
          className={fieldTextAreaClass}
          name="task-details"
          onChange={(event) => setDetails(event.target.value)}
          placeholder="Context, handoff details, or constraints"
          value={details}
        />
      ) : (
        <button
          className="w-fit rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium text-zinc-700 transition hover:bg-white"
          onClick={() => setShowDetails(true)}
          type="button"
        >
          Add details
        </button>
      )}
      <div className="flex items-center justify-end gap-2">
        <button
          className={ghostButtonClass}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className={primaryButtonClass}
          disabled={!title.trim()}
          onClick={handleCreate}
          type="button"
        >
          Create task
        </button>
      </div>
    </div>
  )
}

function TaskRow({
  task,
  onStatusChange,
}: {
  onStatusChange: (status: TaskStatus) => void
  task: NodeTask
}) {
  const overdue = isTaskOverdue(task)

  return (
    <div
      className={`grid gap-3 p-3.5 ${surfaceCardClass} ${
        overdue
          ? 'border-red-200 bg-red-50/70'
          : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 grid gap-2">
          <p className="truncate text-[0.95rem] font-semibold text-zinc-950">
            {task.title}
          </p>
          <div className="flex flex-wrap gap-1.5 text-[0.8125rem]">
            {task.assignee ? <span className={metaChipClass}>{task.assignee}</span> : null}
            {task.due ? (
              <p className={overdue ? 'font-semibold text-red-700' : metaChipClass}>
                Due {task.due}
              </p>
            ) : null}
            <span className={metaChipClass}>{channelLabels[task.channel]}</span>
            {task.sourceNoteId ? <span className={metaChipClass}>Source note</span> : null}
            {overdue ? <p className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700 ring-1 ring-red-200">Overdue</p> : null}
          </div>
        </div>
        <select
          className={`rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-semibold outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100 ${
            overdue
              ? 'border border-red-200 bg-white text-red-700'
              : 'border border-zinc-950/10 bg-zinc-50 text-zinc-800'
          }`}
          onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
          value={task.status}
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {task.details ? (
        <p className="rounded-lg bg-[oklch(0.985_0.003_240)] px-3 py-2.5 text-sm/6 text-zinc-700">
          {task.details}
        </p>
      ) : null}
    </div>
  )
}

function LinkedTaskPreviewList({ tasks }: { tasks: NodeTask[] }) {
  return (
    <div className="grid gap-2" role="list">
      {tasks.map((task) => {
        const overdue = isTaskOverdue(task)

        return (
          <div
            className={`grid gap-3 p-3.5 ${surfaceCardClass} ${
              overdue
                ? 'border-red-200 bg-red-50/70'
                : 'bg-[oklch(0.988_0.004_240)]'
            }`}
            key={task.id}
            role="listitem"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-[0.95rem] font-semibold text-zinc-950">
                {task.title}
              </p>
              <div
                className={`rounded-full px-2 py-1 text-[0.6875rem] font-semibold ring-1 ${
                  overdue
                    ? 'bg-red-100 text-red-700 ring-red-200'
                    : 'bg-white text-zinc-700 ring-zinc-950/10'
                }`}
              >
                {statusLabels[task.status]}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[0.8125rem]">
              {task.assignee ? <span className={metaChipClass}>{task.assignee}</span> : null}
              {task.due ? (
                <p
                  className={
                    overdue
                      ? 'rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700 ring-1 ring-red-200'
                      : metaChipClass
                  }
                >
                  Due {task.due}
                </p>
              ) : null}
              <span className={metaChipClass}>{channelLabels[task.channel]}</span>
              {overdue ? <p className="rounded-full bg-red-100 px-2.5 py-1 font-semibold text-red-700 ring-1 ring-red-200">Overdue</p> : null}
            </div>
            {task.details ? (
              <p className="rounded-lg bg-white px-3 py-2.5 text-sm/6 text-zinc-700">
                {task.details}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function DraftTaskSuggestionEditor({
  suggestion,
  onChange,
  onRemove,
}: {
  onChange: (updates: Partial<DraftTaskSuggestion>) => void
  onRemove: () => void
  suggestion: DraftTaskSuggestion
}) {
  return (
    <div className="grid gap-3 rounded-lg bg-white p-3.5 ring-1 ring-blue-200 shadow-[0_20px_34px_-28px_rgba(24,24,27,0.5)]">
      <div className="flex items-start justify-between gap-2">
        <input
          aria-label="Extracted task title"
          className={`${fieldInputClass} font-medium`}
          onChange={(event) => onChange({ title: event.target.value })}
          placeholder="Task title"
          value={suggestion.title}
        />
        <button
          className="rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium text-zinc-700 transition hover:bg-zinc-50"
          onClick={onRemove}
          type="button"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1">
          <div className={fieldLabelClass}>Owner</div>
          <input
            aria-label="Extracted task assignee"
            className={fieldInputClass}
            onChange={(event) => onChange({ assignee: event.target.value })}
            placeholder="@name"
            value={suggestion.assignee}
          />
        </label>
        <label className="grid gap-1">
          <div className={fieldLabelClass}>Due date</div>
          <input
            aria-label="Extracted task due date"
            className={fieldInputClass}
            onChange={(event) => onChange({ due: event.target.value })}
            type="date"
            value={suggestion.due}
          />
        </label>
      </div>

      <label className="grid gap-1">
        <div className={fieldLabelClass}>Channel</div>
        <select
          aria-label="Extracted task channel"
          className={fieldInputClass}
          onChange={(event) => onChange({ channel: event.target.value as TaskChannel })}
          value={suggestion.channel}
        >
          {Object.entries(channelLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <textarea
        aria-label="Extracted task details"
        className={fieldTextAreaClass}
        onChange={(event) => onChange({ details: event.target.value })}
        placeholder="Context, handoff details, or constraints"
        value={suggestion.details}
      />
    </div>
  )
}

export function NodeDetailsPanel() {
  const [noteBody, setNoteBody] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [autoExtractSignatureByNoteKey, setAutoExtractSignatureByNoteKey] = useState<Record<string, string>>({})
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null)
  const [composer, setComposer] = useState<ComposerState>(null)
  const [creatingDocForNode, setCreatingDocForNode] = useState(false)
  const [editingDoc, setEditingDoc] = useState<FlowDoc | null>(null)
  const [noteExtractionDraft, setNoteExtractionDraft] = useState<NoteExtractionDraft | null>(null)
  const [extractingNoteId, setExtractingNoteId] = useState<string | null>(null)
  const [noteExtractionError, setNoteExtractionError] = useState<{
    message: string
    noteId: string
  } | null>(null)
  const [lastExtractionDebug, setLastExtractionDebug] = useState<ExtractionDebugState | null>(null)
  const previousAutomationSnapshotRef = useRef<{
    nodeId: string | null
    notesById: Record<string, string>
    title: string
  }>({
    nodeId: null,
    notesById: {},
    title: '',
  })
  const selectedNodeId = useFlowEditorStore((state) => state.selectedNodeId)
  const nodes = useFlowEditorStore((state) => state.nodes)
  const selectedNode = useFlowEditorStore((state) =>
    state.nodes.find((node) => node.id === state.selectedNodeId),
  )
  const aiContext = useFlowEditorStore((state) => state.aiContext)
  const flowDescription = useFlowEditorStore((state) => state.flowDescription)
  const flowId = useFlowEditorStore((state) => state.flowId)
  const flowName = useFlowEditorStore((state) => state.flowName)
  const docs = useFlowEditorStore((state) => state.docs)
  const tasks = useFlowEditorStore((state) => state.tasks)
  const updateNodeData = useFlowEditorStore((state) => state.updateNodeData)
  const addNote = useFlowEditorStore((state) => state.addNote)
  const updateNote = useFlowEditorStore((state) => state.updateNote)
  const addDoc = useFlowEditorStore((state) => state.addDoc)
  const updateDoc = useFlowEditorStore((state) => state.updateDoc)
  const deleteDoc = useFlowEditorStore((state) => state.deleteDoc)
  const addTask = useFlowEditorStore((state) => state.addTask)
  const updateTask = useFlowEditorStore((state) => state.updateTask)

  const selectedNodeDocs = useMemo(
    () => docs.filter((doc) => doc.nodeId === selectedNodeId),
    [docs, selectedNodeId],
  )
  const selectedNodeTasks = useMemo(
    () => tasks.filter((task) => task.nodeId === selectedNodeId),
    [selectedNodeId, tasks],
  )
  const selectedNodeTasksByNoteId = useMemo(() => {
    const tasksByNoteId = new Map<string, NodeTask[]>()

    for (const task of selectedNodeTasks) {
      if (!task.sourceNoteId) {
        continue
      }

      tasksByNoteId.set(task.sourceNoteId, [
        ...(tasksByNoteId.get(task.sourceNoteId) ?? []),
        task,
      ])
    }

    return tasksByNoteId
  }, [selectedNodeTasks])
  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set(tasks.map((task) => task.assignee).filter(Boolean)),
      ).sort(),
    [tasks],
  )

  useEffect(() => {
    setIsAddingNote(false)
    setExpandedNoteId(null)
    setCreatingDocForNode(false)
    setEditingDoc(null)
    setNoteExtractionDraft(null)
    setExtractingNoteId(null)
    setNoteExtractionError(null)
    setLastExtractionDebug(null)
  }, [selectedNodeId])

  function getNoteAutomationKey(noteId: string) {
    return `${selectedNode!.id}:${noteId}`
  }

  function getTitleAutomationKey() {
    return getNoteAutomationKey(TITLE_AUTOMATION_NOTE_ID)
  }

  function buildNodeContextSignature(allNotes: string[]) {
    return JSON.stringify({
      nodeId: selectedNode!.id,
      nodeTitle: selectedNode!.data.title.trim(),
      notes: allNotes.map((note) => note.trim()),
    })
  }

  function createTasksFromSuggestions({
    existingTasks,
    noteId,
    suggestions,
  }: {
    existingTasks: NodeTask[]
    noteId?: string
    suggestions: TaskExtractionSuggestion[]
  }) {
    const existingMatchers = [
      ...(noteId ? selectedNodeTasksByNoteId.get(noteId) ?? [] : []),
      ...existingTasks,
    ].map((task) => buildTaskMatcher(task.title, task.details))

    let createdCount = 0

    for (const suggestion of suggestions) {
      const nextTitle = suggestion.title.trim()
      const nextDetails = suggestion.details.trim()
      const nextMatcher = buildTaskMatcher(nextTitle, nextDetails)

      if (
        !nextTitle
        || !nextMatcher.primary
        || existingMatchers.some((existingMatcher) =>
          tasksLookSame(nextMatcher, existingMatcher),
        )
      ) {
        continue
      }

      existingMatchers.push(nextMatcher)
      createdCount += 1
      addTask({
        nodeId: selectedNode!.id,
        sourceNoteId: noteId,
        title: nextTitle,
        assignee: suggestion.assignee.trim(),
        due: suggestion.due.trim(),
        channel: suggestion.channel,
        details: nextDetails,
      })
    }

    return createdCount
  }

  function maybeAutoExtractNote({
    allNotes,
    existingTasks,
    note,
    sourceLabel = 'Note changed',
  }: {
    allNotes: string[]
    existingTasks: NodeTask[]
    note: NodeNote
    sourceLabel?: string
  }) {
    const trimmedBody = note.body.trim()
    if (!trimmedBody) {
      console.log('[VoiceToFlow task extraction] skipped', {
        reason: 'empty note body',
        noteId: note.id,
      })
      setLastExtractionDebug({
        message: 'Skipped because the note is empty.',
        mode: 'auto',
        noteId: note.id,
        request: {
          allNotes,
          existingTaskCount: existingTasks.length,
          nodeId: selectedNode!.id,
          nodeTitle: selectedNode!.data.title,
          noteBody: note.body,
          sourceLabel,
          trigger: 'note',
        },
        requestedAt: new Date().toLocaleTimeString(),
        status: 'skipped',
      })
      return
    }

    if (extractingNoteId === note.id) {
      console.log('[VoiceToFlow task extraction] skipped', {
        reason: 'already extracting this note',
        noteId: note.id,
      })
      setLastExtractionDebug({
        message: 'Skipped because extraction is already running for this note.',
        mode: 'auto',
        noteId: note.id,
        request: {
          allNotes,
          existingTaskCount: existingTasks.length,
          nodeId: selectedNode!.id,
          nodeTitle: selectedNode!.data.title,
          noteBody: note.body,
          sourceLabel,
          trigger: 'note',
        },
        requestedAt: new Date().toLocaleTimeString(),
        status: 'skipped',
      })
      return
    }

    const contentSignature = buildNodeContextSignature(allNotes)
    if (autoExtractSignatureByNoteKey[getNoteAutomationKey(note.id)] === contentSignature) {
      console.log('[VoiceToFlow task extraction] skipped', {
        reason: 'duplicate note signature',
        noteId: note.id,
      })
      setLastExtractionDebug({
        message: 'Skipped because this title + note combination was already processed.',
        mode: 'auto',
        noteId: note.id,
        request: {
          allNotes,
          existingTaskCount: existingTasks.length,
          nodeId: selectedNode!.id,
          nodeTitle: selectedNode!.data.title,
          noteBody: note.body,
          sourceLabel,
          trigger: 'note',
        },
        requestedAt: new Date().toLocaleTimeString(),
        status: 'skipped',
      })
      return
    }

    console.log('[VoiceToFlow task extraction] queued', {
      noteId: note.id,
      sourceLabel,
      trigger: 'note',
    })
    setLastExtractionDebug({
      message: 'Change detected. Waiting for debounce before calling the API.',
      mode: 'auto',
      noteId: note.id,
      request: {
        allNotes,
        existingTaskCount: existingTasks.length,
        nodeId: selectedNode!.id,
        nodeTitle: selectedNode!.data.title,
        noteBody: note.body,
        sourceLabel,
        trigger: 'note',
      },
      requestedAt: new Date().toLocaleTimeString(),
      status: 'queued',
    })
    extractTasksMutation.mutate({
      allNotes,
      contentSignature,
      existingTasks,
      mode: 'auto',
      note,
      sourceLabel,
      trigger: 'note',
    })
  }

  function maybeAutoExtractTitle({
    allNotes,
    existingTasks,
  }: {
    allNotes: string[]
    existingTasks: NodeTask[]
  }) {
    const trimmedTitle = selectedNode!.data.title.trim()
    if (!trimmedTitle) {
      console.log('[VoiceToFlow task extraction] skipped', {
        reason: 'empty title',
      })
      setLastExtractionDebug({
        message: 'Skipped because the title is empty.',
        mode: 'auto',
        noteId: TITLE_AUTOMATION_NOTE_ID,
        request: {
          allNotes,
          existingTaskCount: existingTasks.length,
          nodeId: selectedNode!.id,
          nodeTitle: selectedNode!.data.title,
          noteBody: trimmedTitle,
          sourceLabel: 'Title changed',
          trigger: 'title',
        },
        requestedAt: new Date().toLocaleTimeString(),
        status: 'skipped',
      })
      return
    }

    if (extractingNoteId === TITLE_AUTOMATION_NOTE_ID) {
      console.log('[VoiceToFlow task extraction] skipped', {
        reason: 'already extracting title',
      })
      setLastExtractionDebug({
        message: 'Skipped because title extraction is already running.',
        mode: 'auto',
        noteId: TITLE_AUTOMATION_NOTE_ID,
        request: {
          allNotes,
          existingTaskCount: existingTasks.length,
          nodeId: selectedNode!.id,
          nodeTitle: selectedNode!.data.title,
          noteBody: trimmedTitle,
          sourceLabel: 'Title changed',
          trigger: 'title',
        },
        requestedAt: new Date().toLocaleTimeString(),
        status: 'skipped',
      })
      return
    }

    const contentSignature = buildNodeContextSignature(allNotes)
    if (autoExtractSignatureByNoteKey[getTitleAutomationKey()] === contentSignature) {
      console.log('[VoiceToFlow task extraction] skipped', {
        reason: 'duplicate title signature',
      })
      setLastExtractionDebug({
        message: 'Skipped because this title + notes combination was already processed.',
        mode: 'auto',
        noteId: TITLE_AUTOMATION_NOTE_ID,
        request: {
          allNotes,
          existingTaskCount: existingTasks.length,
          nodeId: selectedNode!.id,
          nodeTitle: selectedNode!.data.title,
          noteBody: trimmedTitle,
          sourceLabel: 'Title changed',
          trigger: 'title',
        },
        requestedAt: new Date().toLocaleTimeString(),
        status: 'skipped',
      })
      return
    }

    console.log('[VoiceToFlow task extraction] queued', {
      noteId: TITLE_AUTOMATION_NOTE_ID,
      sourceLabel: 'Title changed',
      trigger: 'title',
    })
    setLastExtractionDebug({
      message: 'Title change detected. Waiting for debounce before calling the API.',
      mode: 'auto',
      noteId: TITLE_AUTOMATION_NOTE_ID,
      request: {
        allNotes,
        existingTaskCount: existingTasks.length,
        nodeId: selectedNode!.id,
        nodeTitle: selectedNode!.data.title,
        noteBody: trimmedTitle,
        sourceLabel: 'Title changed',
        trigger: 'title',
      },
      requestedAt: new Date().toLocaleTimeString(),
      status: 'queued',
    })
    extractTasksMutation.mutate({
      allNotes,
      contentSignature,
      existingTasks,
      mode: 'auto',
      note: {
        id: TITLE_AUTOMATION_NOTE_ID,
        body: trimmedTitle,
        createdAt: new Date().toISOString(),
      },
      sourceLabel: 'Title changed',
      taskSourceNoteId: undefined,
      trigger: 'title',
    })
  }

  const extractTasksMutation = useMutation({
    mutationFn: async ({
      allNotes,
      contentSignature,
      existingTasks,
      mode = 'manual',
      note,
      sourceLabel = note.id === TITLE_AUTOMATION_NOTE_ID ? 'Title changed' : 'Manual extract',
      taskSourceNoteId = note.id,
      trigger = note.id === TITLE_AUTOMATION_NOTE_ID ? 'title' : 'note',
    }: ExtractTasksMutationPayload) => {
      if (!flowId) {
        throw new Error('Save the flow once before extracting tasks.')
      }

      const request = {
        allNotes,
        existingTaskCount: existingTasks.length,
        nodeId: selectedNode!.id,
        nodeTitle: selectedNode!.data.title,
        noteBody: note.body,
        sourceLabel,
        trigger,
      }

      const suggestions = await extractTasksFromNote(flowId, {
        allNotes,
        aiContext,
        existingTasks,
        flowDescription,
        flowName,
        nodeId: selectedNode!.id,
        nodeKind: selectedNode!.data.kind,
        nodeTitle: selectedNode!.data.title,
        noteId: note.id,
        noteBody: note.body,
      })

      return {
        contentSignature,
        existingTasks,
        mode,
        noteId: note.id,
        request,
        suggestions,
        taskSourceNoteId,
      }
    },
    onMutate: ({
      allNotes,
      existingTasks,
      mode = 'manual',
      note,
      sourceLabel = note.id === TITLE_AUTOMATION_NOTE_ID ? 'Title changed' : 'Manual extract',
      trigger = note.id === TITLE_AUTOMATION_NOTE_ID ? 'title' : 'note',
    }) => {
      setExtractingNoteId(note.id)
      setNoteExtractionError(null)
      setNoteExtractionDraft(null)

      const nextDebugState: ExtractionDebugState = {
        mode,
        noteId: note.id,
        request: {
          allNotes,
          existingTaskCount: existingTasks.length,
          nodeId: selectedNode!.id,
          nodeTitle: selectedNode!.data.title,
          noteBody: note.body,
          sourceLabel,
          trigger,
        },
        requestedAt: new Date().toLocaleTimeString(),
        status: 'calling',
      }

      console.log('[VoiceToFlow task extraction] request', nextDebugState.request)
      setLastExtractionDebug(nextDebugState)
    },
    onSuccess: ({
      contentSignature,
      existingTasks,
      mode,
      noteId,
      request,
      suggestions,
      taskSourceNoteId,
    }) => {
      setExtractingNoteId(null)
      let createdCount = 0

      if (mode === 'auto') {
        createdCount = createTasksFromSuggestions({
          existingTasks,
          noteId: taskSourceNoteId,
          suggestions,
        })

        if (contentSignature) {
          setAutoExtractSignatureByNoteKey((current) => ({
            ...current,
            [getNoteAutomationKey(noteId)]: contentSignature,
          }))
        }

        setNoteExtractionDraft(null)
      } else {
        setNoteExtractionDraft({
          existingTasks,
          noteId,
          suggestions: suggestions.map((suggestion) => ({
            ...suggestion,
            clientId: createDraftSuggestionId(),
          })),
        })
      }

      console.log('[VoiceToFlow task extraction] response', {
        createdCount,
        noteId,
        suggestions,
      })
      setLastExtractionDebug({
        mode,
        noteId,
        request,
        requestedAt: new Date().toLocaleTimeString(),
        response: {
          createdCount,
          suggestions,
        },
        status: 'success',
      })
    },
    onError: (error, { note }) => {
      setExtractingNoteId(null)
      setNoteExtractionDraft(null)
      const message =
        error instanceof Error
          ? error.message
          : 'Could not extract tasks from this note.'
      setNoteExtractionError({
        noteId: note.id,
        message,
      })
      console.error('[VoiceToFlow task extraction] error', {
        message,
        noteId: note.id,
      })
      setLastExtractionDebug((current) =>
        current
        && current.noteId === note.id
          ? {
              ...current,
              errorMessage: message,
              status: 'error',
            }
          : current,
      )
    },
  })

  useEffect(() => {
    if (!selectedNode || !selectedNodeId) {
      return
    }

    const currentTitle = selectedNode.data.title
    const currentNotes = selectedNode.data.notes.map((note) => ({
      body: note.body,
      createdAt: note.createdAt,
      id: note.id,
    }))
    const currentNotesById = Object.fromEntries(
      currentNotes.map((note) => [note.id, note.body]),
    )
    const previousSnapshot = previousAutomationSnapshotRef.current

    if (previousSnapshot.nodeId !== selectedNodeId) {
      previousAutomationSnapshotRef.current = {
        nodeId: selectedNodeId,
        notesById: currentNotesById,
        title: currentTitle,
      }
      return
    }

    const titleChanged = previousSnapshot.title !== currentTitle
    const changedNotes = currentNotes.filter(
      (note) => previousSnapshot.notesById[note.id] !== note.body,
    )

    previousAutomationSnapshotRef.current = {
      nodeId: selectedNodeId,
      notesById: currentNotesById,
      title: currentTitle,
    }

    if (!titleChanged && changedNotes.length === 0) {
      return
    }

    console.log('[VoiceToFlow task extraction] change detected', {
      changedNoteIds: changedNotes.map((note) => note.id),
      nodeId: selectedNodeId,
      titleChanged,
    })

    const allNotes = currentNotes.map((note) => note.body)
    const timeoutId = window.setTimeout(() => {
      const notesToProcess = titleChanged
        ? currentNotes.filter((note) => note.body.trim())
        : changedNotes.filter((note) => note.body.trim())

      if (notesToProcess.length > 0) {
        for (const note of notesToProcess) {
          maybeAutoExtractNote({
            allNotes,
            existingTasks: selectedNodeTasksByNoteId.get(note.id) ?? [],
            note,
            sourceLabel: titleChanged ? 'Title changed' : 'Note changed',
          })
        }
        return
      }

      maybeAutoExtractTitle({
        allNotes,
        existingTasks: selectedNodeTasks,
      })
    }, 700)

    return () => window.clearTimeout(timeoutId)
  }, [
    selectedNode,
    selectedNodeId,
    selectedNodeTasks,
    selectedNodeTasksByNoteId,
  ])

  function handleAddNote() {
    const nextBody = noteBody.trim()

    if (!selectedNodeId || !nextBody) {
      return
    }

    const noteId = addNote(selectedNodeId, nextBody)
    const allNotes = [...selectedNode!.data.notes.map((note) => note.body), nextBody]

    setNoteBody('')
    setIsAddingNote(false)
    maybeAutoExtractNote({
      allNotes,
      existingTasks: [],
      note: {
        id: noteId,
        body: nextBody,
        createdAt: new Date().toISOString(),
      },
    })
  }

  function handleDraftSuggestionChange(
    clientId: string,
    updates: Partial<DraftTaskSuggestion>,
  ) {
    setNoteExtractionDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft
      }

      return {
        ...currentDraft,
        suggestions: currentDraft.suggestions.map((suggestion) =>
          suggestion.clientId === clientId
            ? { ...suggestion, ...updates }
            : suggestion,
        ),
      }
    })
  }

  function handleDraftSuggestionRemove(clientId: string) {
    setNoteExtractionDraft((currentDraft) => {
      if (!currentDraft) {
        return currentDraft
      }

      return {
        ...currentDraft,
        suggestions: currentDraft.suggestions.filter(
          (suggestion) => suggestion.clientId !== clientId,
        ),
      }
    })
  }

  function handleCreateExtractedTasks() {
    if (!noteExtractionDraft) {
      return
    }

    const createdCount = createTasksFromSuggestions({
      existingTasks: noteExtractionDraft.existingTasks,
      noteId: noteExtractionDraft.noteId,
      suggestions: noteExtractionDraft.suggestions,
    })

    console.log('[VoiceToFlow task extraction] tasks added in UI', {
      createdCount,
      noteId: noteExtractionDraft.noteId,
    })
    setLastExtractionDebug((current) =>
      current
      && current.noteId === noteExtractionDraft.noteId
      && current.response
        ? {
            ...current,
            response: {
              ...current.response,
              createdCount,
            },
          }
        : current,
    )
    setNoteExtractionDraft(null)
  }

  if (!selectedNode || !selectedNodeId) {
    return null
  }

  return (
    <aside className="hidden h-full w-[23rem] shrink-0 flex-col overflow-hidden border-l border-zinc-950/8 bg-white xl:w-[25rem] lg:flex">
      <section className="shrink-0 border-b border-zinc-950/8 bg-[oklch(0.988_0.003_240)] px-5 py-4">
        <div className="grid gap-1.5">
          <label className="grid gap-1.5">
            <p className={fieldLabelClass}>Selected node</p>
            <input
              className={`${fieldInputClass} text-base font-semibold`}
              name="node-title"
              onChange={(event) => {
                console.log('[VoiceToFlow task extraction] title input changed', {
                  nodeId: selectedNode.id,
                  title: event.target.value,
                })
                setLastExtractionDebug({
                  message: 'Title edited in UI. Waiting for the automation trigger.',
                  mode: 'auto',
                  noteId: TITLE_AUTOMATION_NOTE_ID,
                  request: {
                    allNotes: selectedNode.data.notes.map((note) => note.body),
                    existingTaskCount: selectedNodeTasks.length,
                    nodeId: selectedNode.id,
                    nodeTitle: event.target.value,
                    noteBody: event.target.value,
                    sourceLabel: 'Title input changed',
                    trigger: 'title',
                  },
                  requestedAt: new Date().toLocaleTimeString(),
                  status: 'queued',
                })
                updateNodeData(selectedNode.id, { title: event.target.value })
              }}
                value={selectedNode.data.title}
              />
            </label>
        </div>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <section className="grid gap-4 px-5 py-5">
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950">Notes</p>
              <p className="mt-1 text-sm/6 text-zinc-600">
                Capture context, ideas, and follow-ups here.
              </p>
            </div>
            <button
              className={`rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isAddingNote
                  ? 'bg-white text-zinc-700 ring-1 ring-zinc-950/8 hover:bg-zinc-50'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              onClick={() => {
                setIsAddingNote((current) => !current)
                setExpandedNoteId(null)
              }}
              type="button"
            >
              {isAddingNote ? 'Close' : 'New note'}
            </button>
          </div>

          {isAddingNote ? (
            <div className={`grid shrink-0 gap-3 bg-[oklch(0.987_0.005_95)] p-3.5 ${surfaceCardClass}`}>
              <textarea
                aria-label="New note"
                autoFocus
                className={fieldTextAreaClass}
                name="new-note"
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder="Add context, assumptions, or next steps"
                value={noteBody}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  className={ghostButtonClass}
                  onClick={() => {
                    setIsAddingNote(false)
                    setNoteBody('')
                  }}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className={primaryButtonClass}
                  disabled={!noteBody.trim()}
                  onClick={handleAddNote}
                  type="button"
                >
                  Add note
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3" role="list">
            {selectedNode.data.notes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-950/15 bg-zinc-50 p-4 text-sm/6 text-zinc-600">
                No notes yet.
              </p>
            ) : (
              selectedNode.data.notes.map((note) => {
                const linkedTasks = selectedNodeTasksByNoteId.get(note.id) ?? []
                const isEditingNote = expandedNoteId === note.id
                return (
                  <div
                    className={`grid gap-3 bg-white p-3.5 transition ${surfaceCardClass} ${
                      isEditingNote ? 'ring-2 ring-blue-200' : 'cursor-text hover:bg-zinc-50/50'
                    }`}
                    key={note.id}
                    onClick={() => {
                      if (!isEditingNote) {
                        setExpandedNoteId(note.id)
                        if (noteExtractionError?.noteId === note.id) {
                          setNoteExtractionError(null)
                        }
                      }
                    }}
                    role="listitem"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      <span className={metaChipClass}>
                        {linkedTasks.length > 0
                          ? `${linkedTasks.length} linked task${linkedTasks.length === 1 ? '' : 's'}`
                          : 'Planning note'}
                      </span>
                      {note.body.trim() ? <span className={metaChipClass}>Source text</span> : null}
                    </div>

                    {isEditingNote ? (
                      <textarea
                        autoFocus
                        className={fieldTextAreaClass}
                        name={`note-${note.id}`}
                        onBlur={() => {
                          setExpandedNoteId(null)
                          maybeAutoExtractNote({
                            allNotes: selectedNode.data.notes.map((item) => item.body),
                            existingTasks: linkedTasks,
                            note: {
                              ...note,
                              body:
                                selectedNode.data.notes.find((item) => item.id === note.id)?.body
                                ?? note.body,
                            },
                          })
                        }}
                        onChange={(event) => {
                          console.log('[VoiceToFlow task extraction] note input changed', {
                            nodeId: selectedNode.id,
                            noteId: note.id,
                          })
                          setLastExtractionDebug({
                            message: 'Note edited in UI. Waiting for the automation trigger.',
                            mode: 'auto',
                            noteId: note.id,
                            request: {
                              allNotes: selectedNode.data.notes.map((item) =>
                                item.id === note.id ? event.target.value : item.body,
                              ),
                              existingTaskCount: linkedTasks.length,
                              nodeId: selectedNode.id,
                              nodeTitle: selectedNode.data.title,
                              noteBody: event.target.value,
                              sourceLabel: 'Note input changed',
                              trigger: 'note',
                            },
                            requestedAt: new Date().toLocaleTimeString(),
                            status: 'queued',
                          })
                          updateNote(selectedNode.id, note.id, event.target.value)

                          if (noteExtractionError?.noteId === note.id) {
                            setNoteExtractionError(null)
                          }
                        }}
                        placeholder="Add context, assumptions, or next steps"
                        value={note.body}
                      />
                    ) : null}

                    {!isEditingNote ? (
                      <div className="rounded-lg bg-[oklch(0.987_0.005_95)] px-3.5 py-3">
                        <p className={noteBodyClass}>{note.body}</p>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="min-w-0 flex-1 text-[0.8125rem] text-zinc-600">
                        {linkedTasks.length > 0
                          ? `${linkedTasks.length} task${linkedTasks.length === 1 ? '' : 's'} already come from this note.`
                          : 'Click the note to edit it.'}
                      </p>
                      {isEditingNote ? (
                        <p className="text-[0.75rem] font-medium text-zinc-400">
                          Click outside to finish
                        </p>
                      ) : null}
                    </div>

                    {noteExtractionError?.noteId === note.id ? (
                      <p className="rounded-lg bg-red-50 p-3 text-sm/6 text-red-700 ring-1 ring-red-600/15">
                        {noteExtractionError.message}
                      </p>
                    ) : null}

                    {noteExtractionDraft?.noteId === note.id ? (
                      <div className="grid gap-3 rounded-lg bg-blue-50 p-3.5 ring-1 ring-blue-200">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-950">AI task review</p>
                            <p className="mt-1 text-[0.8125rem] text-zinc-600">
                              Review missing tasks before adding them.
                            </p>
                          </div>
                          <div className="rounded-full bg-white px-2.5 py-1 text-[0.8125rem] font-semibold tabular-nums text-blue-700 ring-1 ring-blue-200">
                            {noteExtractionDraft.suggestions.length}
                          </div>
                        </div>

                        {noteExtractionDraft.existingTasks.length > 0 ? (
                          <div className="grid gap-2">
                            <p className={fieldLabelClass}>
                              Already linked to this note
                            </p>
                            <LinkedTaskPreviewList tasks={noteExtractionDraft.existingTasks} />
                          </div>
                        ) : null}

                        {noteExtractionDraft.suggestions.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-blue-200 bg-white p-3 text-sm/6 text-zinc-600">
                            {noteExtractionDraft.existingTasks.length > 0
                              ? 'No new tasks suggested. Existing linked tasks already cover this note.'
                              : 'No actionable tasks found in this note yet.'}
                          </p>
                        ) : (
                          <div className="grid gap-2">
                            {noteExtractionDraft.suggestions.map((suggestion) => (
                              <DraftTaskSuggestionEditor
                                key={suggestion.clientId}
                                onChange={(updates) =>
                                  handleDraftSuggestionChange(
                                    suggestion.clientId,
                                    updates,
                                  )
                                }
                                onRemove={() =>
                                  handleDraftSuggestionRemove(suggestion.clientId)
                                }
                                suggestion={suggestion}
                              />
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2">
                          <button
                            className={ghostButtonClass}
                            onClick={() => setNoteExtractionDraft(null)}
                            type="button"
                          >
                            {noteExtractionDraft.suggestions.length === 0 ? 'Close' : 'Cancel'}
                          </button>
                          {noteExtractionDraft.suggestions.length > 0 ? (
                            <button
                              className={primaryButtonClass}
                              disabled={noteExtractionDraft.suggestions.every(
                                (suggestion) => !suggestion.title.trim(),
                              )}
                              onClick={handleCreateExtractedTasks}
                              type="button"
                            >
                              Create tasks
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>

        <section className="border-t border-zinc-950/8 px-5 py-4">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <div>
                <p className="text-sm font-semibold text-zinc-950">Automation activity</p>
                <p className="mt-1 text-sm/6 text-zinc-600">
                  Latest extraction request and response.
                </p>
              </div>
              {lastExtractionDebug ? (
                <p
                  className={`rounded-full px-2.5 py-1 text-[0.72rem] font-semibold ${
                    lastExtractionDebug.status === 'error'
                      ? 'bg-red-50 text-red-700'
                      : lastExtractionDebug.status === 'skipped'
                        ? 'bg-zinc-100 text-zinc-700'
                        : lastExtractionDebug.status === 'queued'
                          ? 'bg-blue-50 text-blue-700'
                      : lastExtractionDebug.status === 'calling'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {lastExtractionDebug.status === 'queued'
                    ? 'Queued'
                    : lastExtractionDebug.status === 'skipped'
                      ? 'Skipped'
                  : lastExtractionDebug.status === 'calling'
                    ? 'Calling API'
                    : lastExtractionDebug.status === 'error'
                      ? 'Failed'
                      : 'Updated'}
                </p>
              ) : null}
            </summary>

            <div className="mt-3">
              {lastExtractionDebug ? (
                <div className={`grid gap-3 p-3.5 ${surfaceCardClass}`}>
                  {lastExtractionDebug.message ? (
                    <p className="rounded-lg bg-zinc-50 px-3 py-2.5 text-sm/6 text-zinc-700">
                      {lastExtractionDebug.message}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={metaChipClass}>{lastExtractionDebug.request.sourceLabel}</span>
                    <span className={metaChipClass}>
                      {lastExtractionDebug.mode === 'auto' ? 'Auto' : 'Manual'}
                    </span>
                    <span className={metaChipClass}>
                      {lastExtractionDebug.response?.suggestions.length ?? 0} suggestions
                    </span>
                    <span className={metaChipClass}>
                      {lastExtractionDebug.response?.createdCount ?? 0} tasks added
                    </span>
                  </div>

                  <div className="grid gap-2 rounded-lg bg-[oklch(0.987_0.005_95)] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.8125rem] font-semibold text-zinc-700">
                        Triggered at {lastExtractionDebug.requestedAt}
                      </p>
                      <p className="text-[0.8125rem] text-zinc-500">
                        {lastExtractionDebug.request.trigger === 'title'
                          ? 'From title'
                          : 'From note'}
                      </p>
                    </div>
                    <p className="text-sm/6 text-zinc-800">
                      {lastExtractionDebug.request.noteBody.trim() || 'No source text sent.'}
                    </p>
                  </div>

                  {lastExtractionDebug.errorMessage ? (
                    <p className="rounded-lg bg-red-50 p-3 text-sm/6 text-red-700 ring-1 ring-red-600/15">
                      {lastExtractionDebug.errorMessage}
                    </p>
                  ) : null}

                  <details className="rounded-lg bg-[oklch(0.99_0.002_240)] p-3 ring-1 ring-zinc-950/8">
                    <summary className="cursor-pointer text-[0.8125rem] font-semibold text-zinc-800">
                      Request payload
                    </summary>
                    <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 px-3 py-3 text-[0.75rem]/5 text-zinc-50">
                      {JSON.stringify(lastExtractionDebug.request, null, 2)}
                    </pre>
                  </details>

                  <details className="rounded-lg bg-[oklch(0.99_0.002_240)] p-3 ring-1 ring-zinc-950/8">
                    <summary className="cursor-pointer text-[0.8125rem] font-semibold text-zinc-800">
                      API response
                    </summary>
                    <pre className="mt-3 overflow-auto rounded-lg bg-zinc-950 px-3 py-3 text-[0.75rem]/5 text-zinc-50">
                      {JSON.stringify(lastExtractionDebug.response?.suggestions ?? [], null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-zinc-950/15 bg-zinc-50 p-3 text-sm/6 text-zinc-600">
                  Change the title or a note to trigger extraction. The latest API request
                  and response will show here.
                </p>
              )}
            </div>
          </details>
        </section>

        <section className="border-t border-zinc-950/8 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950">Doc modals</p>
              <p className="mt-1 text-sm/6 text-zinc-600">
                Longer details linked to this node.
              </p>
            </div>
            <button
              className={secondaryButtonClass}
              onClick={() => setCreatingDocForNode(true)}
              type="button"
            >
              New doc
            </button>
          </div>

          <div className="mt-3 grid gap-2" role="list">
            {selectedNodeDocs.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-950/15 bg-zinc-50 p-3 text-sm/6 text-zinc-600">
                No doc modals linked to this node yet.
              </p>
            ) : (
              selectedNodeDocs.map((doc) => (
                <button
                  className={`grid gap-2 bg-[oklch(0.987_0.004_235)] p-3.5 text-left transition hover:bg-[oklch(0.979_0.006_235)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${surfaceCardClass}`}
                  key={doc.id}
                  onClick={() => setEditingDoc(doc)}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <DocIcon className="size-4 shrink-0 text-zinc-600" />
                    <p className="truncate text-[0.95rem] font-semibold text-zinc-950">
                      {doc.title}
                    </p>
                  </div>
                  <p className="line-clamp-2 text-sm/6 text-zinc-700">
                    {doc.body || 'No body yet.'}
                  </p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="border-t border-zinc-950/8 px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-950">Tasks</p>
              <p className="mt-1 text-sm/6 text-zinc-600">
                Track work that comes out of this node.
              </p>
            </div>
            <button
              className={`rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                composer
                  ? 'bg-white text-zinc-700 ring-1 ring-zinc-950/8 hover:bg-zinc-50'
                  : 'bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
              }`}
              onClick={() => setComposer((current) => (current ? null : { initialTitle: '' }))}
              type="button"
            >
              {composer ? 'Close' : 'New task'}
            </button>
          </div>

          <div className="mt-3 grid gap-3">
            {composer ? (
              <TaskComposer
                assigneeOptions={assigneeOptions}
                initialTitle={composer.initialTitle}
                onCancel={() => setComposer(null)}
                onCreate={(task) => {
                  addTask({
                    ...task,
                    nodeId: selectedNode.id,
                    sourceNoteId: composer.sourceNoteId,
                  })
                  setComposer(null)
                }}
              />
            ) : null}

            <div className="grid gap-2" role="list">
              {selectedNodeTasks.length === 0 ? (
                <p className="rounded-lg border border-dashed border-zinc-950/15 bg-zinc-50 p-3 text-sm/6 text-zinc-600">
                  No tasks yet. Create one here or turn a note into a task.
                </p>
              ) : (
                selectedNodeTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    onStatusChange={(status) => updateTask(task.id, { status })}
                    task={task}
                  />
                ))
              )}
            </div>
          </div>
        </section>
      </div>
      {creatingDocForNode ? (
        <DocModal
          initialNodeId={selectedNode.id}
          nodes={nodes}
          onClose={() => setCreatingDocForNode(false)}
          onSave={(doc) => {
            addDoc(doc)
            setCreatingDocForNode(false)
          }}
        />
      ) : null}
      {editingDoc ? (
        <DocModal
          doc={editingDoc}
          nodes={nodes}
          onClose={() => setEditingDoc(null)}
          onDelete={(docId) => {
            deleteDoc(docId)
            setEditingDoc(null)
          }}
          onSave={(doc) => {
            updateDoc(editingDoc.id, doc)
            setEditingDoc(null)
          }}
        />
      ) : null}
    </aside>
  )
}
