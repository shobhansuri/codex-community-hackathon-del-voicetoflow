import { useMemo } from 'react'
import type { TaskChannel } from '../canvas/flowTypes'
import { useFlowEditorStore } from '../state/flowEditorStore'
import { isTaskOverdue } from './taskDue'

const channelLabels: Record<TaskChannel, string> = {
  general: 'General',
  whatsapp: 'WhatsApp',
  call: 'Call',
  email: 'Email',
}

export function TaskDrawer() {
  const nodes = useFlowEditorStore((state) => state.nodes)
  const tasks = useFlowEditorStore((state) => state.tasks)
  const setSelectedNodeId = useFlowEditorStore((state) => state.setSelectedNodeId)
  const nodeTitleById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node.data.title])),
    [nodes],
  )
  const openTaskCount = tasks.filter((task) => task.status !== 'done').length

  return (
    <div className="border-t border-zinc-950/10 bg-white px-5 py-3">
      <div className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="shrink-0">
            <p className="text-sm font-semibold text-zinc-950">Tasks</p>
            <div className="mt-1 w-fit rounded-full bg-zinc-100 px-2 py-1 text-xs font-medium tabular-nums text-zinc-600">
              {openTaskCount} open
            </div>
          </div>

          {tasks.length === 0 ? (
            <p className="pt-1 text-xs text-zinc-500">
              Create tasks from notes or with + Task in the inspector.
            </p>
          ) : (
            <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
              {tasks.map((task) => {
                const overdue = isTaskOverdue(task)

                return (
                  <button
                    className={`min-w-64 max-w-80 rounded-md px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                      overdue
                        ? 'border border-red-200 bg-red-50/70 hover:bg-red-50'
                        : 'border border-zinc-950/10 bg-white hover:bg-zinc-50'
                    }`}
                    key={task.id}
                    onClick={() => setSelectedNodeId(task.nodeId)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-zinc-950">
                        {task.title}
                      </p>
                      <div
                        className={`rounded-md px-1.5 py-0.5 text-[0.6875rem] font-medium ring-1 ${
                          overdue
                            ? 'bg-red-100 text-red-700 ring-red-200'
                            : 'bg-zinc-100 text-zinc-600 ring-zinc-950/10'
                        }`}
                      >
                        {task.status.replace('_', ' ')}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1 text-xs text-zinc-600">
                      {task.assignee ? <span>{task.assignee}</span> : null}
                      {task.due ? (
                        <p className={overdue ? 'font-medium text-red-700' : ''}>
                          Due {task.due}
                        </p>
                      ) : null}
                      <span>{channelLabels[task.channel]}</span>
                      <span>{nodeTitleById.get(task.nodeId) ?? 'Node'}</span>
                      {task.sourceNoteId ? <span>Source note</span> : null}
                      {overdue ? <p className="font-medium text-red-700">Overdue</p> : null}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
