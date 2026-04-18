import { useEffect, useRef } from 'react'
import type { RealtimeConversationMessage } from './useRealtimeFlow'

type VoiceConversationPanelProps = {
  activity: string
  error: string
  isActive: boolean
  isConnecting: boolean
  messages: RealtimeConversationMessage[]
  onClear: () => void
}

const roleLabels: Record<RealtimeConversationMessage['role'], string> = {
  assistant: 'Assistant',
  system: 'Voice',
  tool: 'Action',
  user: 'You',
}

function getMessageClass(role: RealtimeConversationMessage['role']) {
  if (role === 'user') {
    return 'ml-7 border-blue-200 bg-blue-50 text-blue-950'
  }

  if (role === 'tool') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-950'
  }

  if (role === 'system') {
    return 'border-zinc-950/10 bg-zinc-50 text-zinc-700'
  }

  return 'mr-7 border-zinc-950/10 bg-white text-zinc-950'
}

export function VoiceConversationPanel({
  activity,
  error,
  isActive,
  isConnecting,
  messages,
  onClear,
}: VoiceConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const statusLabel = isConnecting
    ? 'Connecting'
    : isActive
      ? 'Listening'
      : error
        ? 'Needs attention'
        : 'Ready'

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [messages])

  return (
    <aside className="flex w-[24rem] shrink-0 flex-col border-l border-zinc-950/10 bg-white">
      <div className="border-b border-zinc-950/10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-950">
              Voice conversation
            </p>
            <p className="text-sm text-zinc-500">
              Commands, replies, and flow updates.
            </p>
          </div>
          <div
            className={`rounded-md px-2 py-1 text-sm font-medium ${
              isActive
                ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'
                : error
                  ? 'bg-red-50 text-red-700 ring-1 ring-red-100'
                  : 'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-950/10'
            }`}
          >
            {statusLabel}
          </div>
        </div>
        {activity ? (
          <p className="mt-3 rounded-md bg-zinc-50 p-2 text-sm text-zinc-700 ring-1 ring-zinc-950/10">
            {activity}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 rounded-md bg-red-50 p-2 text-sm font-medium text-red-700 ring-1 ring-red-100">
            {error}
          </p>
        ) : null}
      </div>

      <div
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4"
        ref={scrollRef}
      >
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <p className="text-sm font-medium text-zinc-950">
                Start talking to the flow.
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                Your words and flow changes will appear here.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div
              className={`rounded-md border p-3 ${getMessageClass(message.role)}`}
              key={message.id}
            >
              <div className="text-sm font-semibold">
                {roleLabels[message.role]}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-pretty">
                {message.text}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-zinc-950/10 p-3">
        <button
          className="w-full rounded-md bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          onClick={onClear}
          type="button"
        >
          Clear conversation
        </button>
      </div>
    </aside>
  )
}
