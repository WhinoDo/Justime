'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

/**
 * SSE Event types from backend
 */
export type SSEEventType = 'start' | 'token' | 'metadata' | 'usage' | 'done' | 'error' | 'resume'

export interface SSEEvent {
  event: SSEEventType
  id?: string
  content?: string
  message_id?: string
  conversation_id?: string
  metadata?: {
    ragReferences?: Array<{
      referenceId: string
      docPath: string
      fileName: string
      score: number
      snippets: string[]
      queries: string[]
    }>
    timingStrategy?: Record<string, unknown>
    taskAnalysis?: Record<string, unknown>
    suggestedEvents?: Array<Record<string, unknown>>
    taskDecomposition?: Record<string, unknown>
  }
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  error?: string
}

export interface SSEChatOptions {
  onToken?: (token: string, messageId?: string) => void
  onMetadata?: (metadata: SSEEvent['metadata']) => void
  onUsage?: (usage: SSEEvent['usage']) => void
  onDone?: (messageId?: string) => void
  onError?: (error: string) => void
  onStart?: (conversationId: string) => void
  maxRetries?: number
  retryDelay?: number
}

export interface SSEChatState {
  isConnected: boolean
  isStreaming: boolean
  error: string | null
  lastEventId: string | null
  content: string
  messageId: string | null
  conversationId: string | null
  metadata: SSEEvent['metadata'] | null
  usage: SSEEvent['usage'] | null
}

/**
 * Custom hook for SSE streaming chat
 * Handles connection, event parsing, reconnection, and error handling
 */
export function useSSEChat(options: SSEChatOptions = {}) {
  const {
    onToken,
    onMetadata,
    onUsage,
    onDone,
    onError,
    onStart,
    maxRetries = 3,
    retryDelay = 1000,
  } = options

  const [state, setState] = useState<SSEChatState>({
    isConnected: false,
    isStreaming: false,
    error: null,
    lastEventId: null,
    content: '',
    messageId: null,
    conversationId: null,
    metadata: null,
    usage: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)
  const retryCountRef = useRef(0)
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)

  /**
   * Parse SSE event from raw text
   */
  const parseSSEEvent = useCallback((rawEvent: string): SSEEvent | null => {
    const lines = rawEvent.split('\n')
    let data: string | null = null
    let id: string | null = null

    for (const line of lines) {
      if (line.startsWith('data:')) {
        data = line.slice(5).trim()
      } else if (line.startsWith('id:')) {
        id = line.slice(3).trim()
      }
    }

    if (!data) return null

    try {
      const parsed = JSON.parse(data) as SSEEvent
      if (id) {
        parsed.id = id
      }
      return parsed
    } catch (e) {
      console.warn('Failed to parse SSE event:', data, e)
      return null
    }
  }, [])

  /**
   * Handle individual SSE event
   */
  const handleEvent = useCallback((event: SSEEvent) => {
    // Update last event ID for reconnection
    if (event.id) {
      setState(prev => ({ ...prev, lastEventId: event.id }))
    }

    switch (event.event) {
      case 'start':
        setState(prev => ({
          ...prev,
          isConnected: true,
          isStreaming: true,
          conversationId: event.conversation_id || null,
          messageId: event.message_id || null,
        }))
        if (event.conversation_id) {
          onStart?.(event.conversation_id)
        }
        break

      case 'token':
        if (event.content) {
          setState(prev => ({
            ...prev,
            content: prev.content + event.content,
            messageId: event.message_id || prev.messageId,
          }))
          onToken?.(event.content, event.message_id)
        }
        break

      case 'metadata':
        setState(prev => ({
          ...prev,
          metadata: event.metadata || null,
        }))
        onMetadata?.(event.metadata)
        break

      case 'usage':
        setState(prev => ({
          ...prev,
          usage: event.usage || null,
        }))
        onUsage?.(event.usage)
        break

      case 'done':
        setState(prev => ({
          ...prev,
          isStreaming: false,
          isConnected: false,
        }))
        onDone?.(state.messageId || undefined)
        break

      case 'error':
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: event.error || 'Unknown error',
        }))
        onError?.(event.error || 'Unknown error')
        break

      default:
        console.warn('Unknown SSE event type:', event.event)
    }
  }, [onToken, onMetadata, onUsage, onDone, onError, onStart, state.messageId])

  /**
   * Process SSE stream
   */
  const processStream = useCallback(async (response: Response) => {
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body is not readable')
    }

    readerRef.current = reader
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          // Process any remaining buffer
          if (buffer.trim()) {
            const event = parseSSEEvent(buffer)
            if (event) {
              handleEvent(event)
            }
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Split by double newline to get complete events
        const events = buffer.split('\n\n')
        buffer = events.pop() || '' // Keep incomplete event in buffer

        for (const rawEvent of events) {
          if (rawEvent.trim() && !rawEvent.startsWith(':')) {
            // Skip heartbeat comments
            const event = parseSSEEvent(rawEvent)
            if (event) {
              handleEvent(event)
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
      readerRef.current = null
    }
  }, [parseSSEEvent, handleEvent])

  /**
   * Send a streaming chat message
   */
  const sendMessage = useCallback(async (
    message: string,
    payload: Record<string, unknown> = {}
  ) => {
    // Reset state for new message
    setState(prev => ({
      ...prev,
      content: '',
      error: null,
      metadata: null,
      usage: null,
      isStreaming: true,
    }))
    retryCountRef.current = 0

    // Create abort controller for this request
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    const attemptRequest = async (attempt: number): Promise<void> => {
      try {
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        }

        // Add Last-Event-ID for reconnection
        if (state.lastEventId) {
          headers['Last-Event-ID'] = state.lastEventId
        }

        const response = await fetch(API_ENDPOINTS.CHAT.STREAM, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message,
            stream: true,
            ...payload,
          }),
          signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`)
        }

        // Check content type for SSE
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('text/event-stream')) {
          // Fall back to non-streaming response
          const data = await response.json()
          if (data.success && data.data?.response) {
            setState(prev => ({
              ...prev,
              content: data.data.response,
              isStreaming: false,
              messageId: data.data.messageId,
              metadata: {
                ragReferences: data.data.ragReferences,
                timingStrategy: data.data.timingStrategy,
                taskAnalysis: data.data.taskAnalysis,
                suggestedEvents: data.data.suggestedEvents,
                taskDecomposition: data.data.taskDecomposition,
              },
            }))
            onDone?.(data.data.messageId)
          } else {
            throw new Error(data.error?.message || 'Failed to get response')
          }
          return
        }

        // Process SSE stream
        await processStream(response)
        retryCountRef.current = 0 // Reset on success

      } catch (error) {
        // Don't retry if aborted
        if ((error as Error).name === 'AbortError') {
          return
        }

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'

        // Check if we should retry
        if (attempt < maxRetries) {
          console.warn(`SSE connection failed, retrying (${attempt + 1}/${maxRetries})...`)
          const delay = retryDelay * Math.pow(2, attempt) // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
          return attemptRequest(attempt + 1)
        }

        // Max retries exceeded
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: errorMessage,
        }))
        onError?.(errorMessage)
      }
    }

    await attemptRequest(0)
  }, [state.lastEventId, maxRetries, retryDelay, processStream, onDone, onError])

  /**
   * Cancel ongoing stream
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    if (readerRef.current) {
      readerRef.current.cancel()
      readerRef.current = null
    }
    setState(prev => ({
      ...prev,
      isStreaming: false,
      isConnected: false,
    }))
  }, [])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    cancel()
    setState({
      isConnected: false,
      isStreaming: false,
      error: null,
      lastEventId: null,
      content: '',
      messageId: null,
      conversationId: null,
      metadata: null,
      usage: null,
    })
  }, [cancel])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel()
    }
  }, [cancel])

  return {
    ...state,
    sendMessage,
    cancel,
    reset,
  }
}
