import { useCallback, useEffect, useRef, useState } from 'react'
import { createRealtimeSession } from '../api/flowApi'
import {
  createRealtimeConnection,
  type RealtimeConnection,
  type RealtimeServerEvent,
} from './realtimeClient'
import {
  buildRealtimeFlowContext,
  executeRealtimeToolCall,
} from './realtimeTools'

type RealtimeStatus = 'idle' | 'connecting' | 'listening' | 'error'

type RealtimeFunctionCall = {
  arguments?: string
  call_id?: string
  name?: string
  type?: string
}

export type RealtimeConversationMessage = {
  id: string
  role: 'assistant' | 'system' | 'tool' | 'user'
  text: string
}

function createMessageId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`
}

function getEventErrorMessage(event: RealtimeServerEvent) {
  const error = event.error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) {
      return message
    }
  }

  const message = event.message
  return typeof message === 'string' && message.trim()
    ? message
    : 'Realtime returned an error.'
}

function getFunctionCalls(event: RealtimeServerEvent): RealtimeFunctionCall[] {
  if (event.type === 'response.output_item.done') {
    const item = event.item
    if (
      item &&
      typeof item === 'object' &&
      (item as RealtimeFunctionCall).type === 'function_call'
    ) {
      return [item as RealtimeFunctionCall]
    }
  }

  if (event.type !== 'response.done') {
    return []
  }

  const response = event.response
  if (!response || typeof response !== 'object' || !('output' in response)) {
    return []
  }

  const output = (response as { output?: unknown }).output
  if (!Array.isArray(output)) {
    return []
  }

  return output.filter(
    (item): item is RealtimeFunctionCall =>
      item &&
      typeof item === 'object' &&
      (item as RealtimeFunctionCall).type === 'function_call',
  )
}

function createFunctionOutputEvent(callId: string, output: unknown) {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: callId,
      output: JSON.stringify(output),
    },
  }
}

function createFlowContextEvent() {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text:
            'Current VoiceToFlow canvas state. Use these IDs when editing: ' +
            JSON.stringify(buildRealtimeFlowContext()),
        },
      ],
    },
  }
}

function createUpdatedFlowContextEvent() {
  return {
    type: 'conversation.item.create',
    item: {
      type: 'message',
      role: 'user',
      content: [
        {
          type: 'input_text',
          text:
            'Updated VoiceToFlow canvas state after the last tool call. Use these IDs for the next edit: ' +
            JSON.stringify(buildRealtimeFlowContext()),
        },
      ],
    },
  }
}

export function useRealtimeFlow(flowId: string) {
  const connectionRef = useRef<RealtimeConnection | null>(null)
  const processedCallIdsRef = useRef(new Set<string>())
  const [activity, setActivity] = useState('')
  const [error, setError] = useState('')
  const [messages, setMessages] = useState<RealtimeConversationMessage[]>([])
  const [status, setStatus] = useState<RealtimeStatus>('idle')

  const clearMessages = useCallback(() => {
    setMessages([])
    setActivity('')
  }, [])

  const appendMessage = useCallback(
    (role: RealtimeConversationMessage['role'], text: string) => {
      const cleanedText = text.trim()
      if (!cleanedText) {
        return
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: createMessageId(role),
          role,
          text: cleanedText,
        },
      ])
    },
    [],
  )

  const upsertMessage = useCallback(
    (message: RealtimeConversationMessage) => {
      if (!message.text.trim()) {
        return
      }

      setMessages((currentMessages) => {
        const existingIndex = currentMessages.findIndex(
          (currentMessage) => currentMessage.id === message.id,
        )

        if (existingIndex === -1) {
          return [...currentMessages, message]
        }

        return currentMessages.map((currentMessage, index) =>
          index === existingIndex ? message : currentMessage,
        )
      })
    },
    [],
  )

  const stop = useCallback(() => {
    connectionRef.current?.close()
    connectionRef.current = null
    setStatus('idle')
    setError('')
  }, [])

  const handleEvent = useCallback((event: RealtimeServerEvent) => {
    if (event.type === 'error' || event.type === 'invalid_request_error') {
      const message = getEventErrorMessage(event)
      setError(message)
      appendMessage('system', message)
      setStatus('error')
      return
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      const transcript = typeof event.transcript === 'string' ? event.transcript : ''
      const itemId = typeof event.item_id === 'string' ? event.item_id : createMessageId('user')
      upsertMessage({
        id: `user_${itemId}`,
        role: 'user',
        text: transcript,
      })
    }

    if (event.type === 'conversation.item.input_audio_transcription.delta') {
      const delta = typeof event.delta === 'string' ? event.delta : ''
      const itemId = typeof event.item_id === 'string' ? event.item_id : 'active'
      const messageId = `user_${itemId}`

      setMessages((currentMessages) => {
        const existingMessage = currentMessages.find(
          (currentMessage) => currentMessage.id === messageId,
        )
        if (!existingMessage) {
          return [
            ...currentMessages,
            {
              id: messageId,
              role: 'user',
              text: delta,
            },
          ]
        }

        return currentMessages.map((currentMessage) =>
          currentMessage.id === messageId
            ? { ...currentMessage, text: `${currentMessage.text}${delta}` }
            : currentMessage,
        )
      })
    }

    if (
      event.type === 'response.audio_transcript.delta' ||
      event.type === 'response.output_text.delta' ||
      event.type === 'response.text.delta'
    ) {
      const delta = typeof event.delta === 'string' ? event.delta : ''
      const responseId =
        typeof event.response_id === 'string'
          ? event.response_id
          : typeof event.item_id === 'string'
            ? event.item_id
            : 'active'
      const messageId = `assistant_${responseId}`

      setMessages((currentMessages) => {
        const existingMessage = currentMessages.find(
          (currentMessage) => currentMessage.id === messageId,
        )
        if (!existingMessage) {
          return [
            ...currentMessages,
            {
              id: messageId,
              role: 'assistant',
              text: delta,
            },
          ]
        }

        return currentMessages.map((currentMessage) =>
          currentMessage.id === messageId
            ? { ...currentMessage, text: `${currentMessage.text}${delta}` }
            : currentMessage,
        )
      })
    }

    if (
      event.type === 'response.audio_transcript.done' ||
      event.type === 'response.output_text.done' ||
      event.type === 'response.text.done'
    ) {
      const transcript =
        typeof event.transcript === 'string'
          ? event.transcript
          : typeof event.text === 'string'
            ? event.text
            : ''
      const responseId =
        typeof event.response_id === 'string'
          ? event.response_id
          : typeof event.item_id === 'string'
            ? event.item_id
            : createMessageId('assistant')

      if (transcript) {
        upsertMessage({
          id: `assistant_${responseId}`,
          role: 'assistant',
          text: transcript,
        })
      }
    }

    const calls = getFunctionCalls(event)
    if (calls.length === 0) {
      return
    }

    for (const call of calls) {
      if (call.call_id && processedCallIdsRef.current.has(call.call_id)) {
        continue
      }

      if (call.call_id) {
        processedCallIdsRef.current.add(call.call_id)
      }

      const result = executeRealtimeToolCall(call)
      if (result.message) {
        setActivity(result.message)
        appendMessage('tool', result.message)
      }

      if (call.call_id) {
        connectionRef.current?.send(createFunctionOutputEvent(call.call_id, result))
        connectionRef.current?.send(createUpdatedFlowContextEvent())
        connectionRef.current?.send({ type: 'response.create' })
      }
    }
  }, [appendMessage, upsertMessage])

  const start = useCallback(async () => {
    if (status === 'connecting' || status === 'listening') {
      return
    }

    setActivity('')
    setError('')
    processedCallIdsRef.current.clear()
    setStatus('connecting')

    try {
      const session = await createRealtimeSession(flowId)
      const connection = await createRealtimeConnection({
        clientSecret: session.clientSecret,
        onClose: () => {
          connectionRef.current = null
          setStatus((currentStatus) =>
            currentStatus === 'error' ? currentStatus : 'idle',
          )
        },
        onError: (message) => {
          setError(message)
          appendMessage('system', message)
          setStatus('error')
        },
        onEvent: handleEvent,
        onOpen: (send) => {
          send(createFlowContextEvent())
          const message = `Listening with ${session.model}`
          setActivity(message)
          appendMessage('system', message)
          setStatus('listening')
        },
      })

      connectionRef.current = connection
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Voice mode could not start.',
      )
      appendMessage(
        'system',
        caughtError instanceof Error
          ? caughtError.message
          : 'Voice mode could not start.',
      )
      setStatus('error')
      connectionRef.current = null
    }
  }, [appendMessage, flowId, handleEvent, status])

  const toggle = useCallback(() => {
    if (status === 'listening' || status === 'connecting') {
      stop()
      return
    }

    void start()
  }, [start, status, stop])

  useEffect(
    () => () => {
      connectionRef.current?.close()
      connectionRef.current = null
    },
    [],
  )

  return {
    activity,
    clearMessages,
    error,
    isActive: status === 'listening',
    isConnecting: status === 'connecting',
    messages,
    start,
    status,
    stop,
    toggle,
  }
}
