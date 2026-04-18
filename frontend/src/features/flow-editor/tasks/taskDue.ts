import type { NodeTask, TaskStatus } from '../canvas/flowTypes'

function parseDueDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) {
    return null
  }

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

function isClosedStatus(status: TaskStatus) {
  return status === 'done' || status === 'cancelled'
}

export function isTaskOverdue(task: Pick<NodeTask, 'due' | 'status'>) {
  if (!task.due || isClosedStatus(task.status)) {
    return false
  }

  const dueDate = parseDueDate(task.due)
  if (!dueDate) {
    return false
  }

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return dueDate < today
}
