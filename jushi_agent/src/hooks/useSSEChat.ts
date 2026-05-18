'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// SSE 事件类型
export type SSEEventType = 'start' | 'token' | 'metadata' | 'usage' | 'done' | 'error'

// SSE 事件接口
export interface SSEEvent {
  event: SSEEventType
  id?: string
  data: Record<string, unknown>
}

// SSE 连接状态
export type SSEConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

// Hook 配置
export interface UseSSEChatConfig {
  endpoint: string
  onToken?: (token: string, messageId?: string) => void
  onMetadata?: (metadata: Record<string, unknown>) => void
  onUsage?: (usage: { promptTokens: number; completionTokens: number; totalTokens: number }) => void
  onDone?: (messageId: string, fullContent: string) => void
  onError?: (error: string) => void
  onStart?: (conversationId: string, messageId: string) => void
  maxRetries?: number
  retryDelay?: number
}

// Hook 返回值
export interface UseSSEChatReturn {
  connectionState: SSEConnectionState
  isStreaming: boolean
  content: string
  error: string | null
  messageId: string | null
  lastEventId: string | null
  sendMessage: (message: string, sessionId?: string, modelId?: string) => Promise<void>
  stop: () => void
  reconnect: () => Promise<void>
  reset: () => void
}

export function useSSEChat(config: UseSSEChatConfig): UseSSEChatReturn {
  const {
    endpoint,
    onToken,
    onMetadata,
    onUsage,
    onDone,
    onError,
    onStart,
    maxRetries = 3,
    retryDelay = 1000,
  } = config

  const [connectionState, setConnectionState] = useState<SSEConnectionState>('disconnected')
  const [isStreaming, setIsStreaming] = useState(false)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [messageId, setMessageId] = useState<string | null>(null)
  const [lastEventId, setLastEventId] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const retryCountRef = useRef(0)
  const contentRef = useRef('')
  const pendingRequestRef = useRef<{ message: string; sessionId?: string; modelId?: string } | null>(null)

  // 解析 SSE 事件
  const parseSSEEvent = (line: string): SSEEvent | null => {
    if (!line.startsWith('data:')) return null
    
    const dataStr = line.slice(5).trim()
    if (!dataStr) return null
    
    try {
      const parsed = JSON.parse(dataStr)
      return {
        event: parsed.event || 'token',
        id: parsed.id,
        data: parsed,
      }
    } catch {
      return null
    }
  }

  // 处理 SSE 事件
  const handleEvent = useCallback((event: SSEEvent) => {
    // 更新 lastEventId
    if (event.id) {
      setLastEventId(event.id)
    }

    switch (event.event) {
      case 'start':
        setMessageId(event.data.messageId as string || null)
        if (onStart && event.data.conversationId && event.data.messageId) {
          onStart(event.data.conversationId as string, event.data.messageId as string)
        }
        break

      case 'token':
        const token = event.data.content as string
        if (token) {
          contentRef.current += token
          setContent(contentRef.current)
          onToken?.(token, event.data.messageId as string)
        }
        break

      case 'metadata':
        onMetadata?.(event.data)
        break

      case 'usage':
        if (event.data.promptTokens !== undefined) {
          onUsage?.({
            promptTokens: event.data.promptTokens as number,
            completionTokens: event.data.completionTokens as number,
            totalTokens: event.data.totalTokens as number,
          })
        }
        break

      case 'done':
        setIsStreaming(false)
        setConnectionState('disconnected')
        if (event.data.messageId) {
          onDone?.(event.data.messageId as string, contentRef.current)
        }
        break

      case 'error':
        const errorMsg = (event.data.message as string) || '未知错误'
        setError(errorMsg)
        setIsStreaming(false)
        setConnectionState('error')
        onError?.(errorMsg)
        break
    }
  }, [onToken, onMetadata, onUsage, onDone, onError, onStart])

  // 发送消息
  const sendMessage = useCallback(async (
    message: string,
    sessionId?: string,
    modelId?: string
  ) => {
    // 重置状态
    setContent('')
    contentRef.current = ''
    setError(null)
    setMessageId(null)
    retryCountRef.current = 0
    pendingRequestRef.current = { message, sessionId, modelId }

    await connect(message, sessionId, modelId)
  }, [endpoint])

  // 连接 SSE
  const connect = async (
    message: string,
    sessionId?: string,
    modelId?: string,
    resumeEventId?: string
  ) => {
    setConnectionState('connecting')
    setIsStreaming(true)

    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // 断点续传
      if (resumeEventId || lastEventId) {
        headers['Last-Event-ID'] = resumeEventId || lastEventId || ''
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message,
          sessionId,
          runtimeModelId: modelId,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      setConnectionState('connected')

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          // 跳过心跳注释
          if (line.startsWith(':')) continue
          
          const event = parseSSEEvent(line)
          if (event) {
            handleEvent(event)
          }
        }
      }

      // 处理剩余的 buffer
      if (buffer.trim()) {
        if (!buffer.startsWith(':')) {
          const event = parseSSEEvent(buffer)
          if (event) {
            handleEvent(event)
          }
        }
      }

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // 用户主动取消，不视为错误
        return
      }

      const errorMsg = err instanceof Error ? err.message : '连接失败'
      
      // 重试逻辑
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++
        const delay = retryDelay * Math.pow(2, retryCountRef.current - 1) // 指数退避
        
        console.log(`SSE 连接失败，${delay}ms 后重试 (${retryCountRef.current}/${maxRetries})`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        
        if (pendingRequestRef.current) {
          await connect(
            pendingRequestRef.current.message,
            pendingRequestRef.current.sessionId,
            pendingRequestRef.current.modelId,
            lastEventId || undefined
          )
        }
      } else {
        setError(errorMsg)
        setConnectionState('error')
        setIsStreaming(false)
        onError?.(errorMsg)
      }
    }
  }

  // 停止流
  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setConnectionState('disconnected')
  }, [])

  // 重连
  const reconnect = useCallback(async () => {
    if (!pendingRequestRef.current || !lastEventId) {
      return
    }
    
    retryCountRef.current = 0
    await connect(
      pendingRequestRef.current.message,
      pendingRequestRef.current.sessionId,
      pendingRequestRef.current.modelId,
      lastEventId
    )
  }, [lastEventId])

  // 重置
  const reset = useCallback(() => {
    stop()
    setContent('')
    contentRef.current = ''
    setError(null)
    setMessageId(null)
    setLastEventId(null)
    pendingRequestRef.current = null
    retryCountRef.current = 0
  }, [stop])

  // 清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    connectionState,
    isStreaming,
    content,
    error,
    messageId,
    lastEventId,
    sendMessage,
    stop,
    reconnect,
    reset,
  }
}
