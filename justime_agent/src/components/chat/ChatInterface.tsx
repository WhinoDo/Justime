'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Message, RagReference, SuggestedCalendarEvent, TaskDecomposition, TimingStrategy, TaskAnalysis, SubtaskItem, MessageFromAPI, ModelConfig } from '@/types'
import { generateId } from '@/lib/utils'
import { TaskItem } from '@/lib/ai/task-planner'
import { TimeAwareTaskInput } from './TimeAwareTaskInput'
import { useAuth } from '@/hooks/useAuth'
import { API_ENDPOINTS } from '@/lib/api/endpoints'
import { ChatHeader, ChatHeaderProps } from './ChatHeader'
import { ChatInputArea, ChatInputAreaProps } from './ChatInputArea'
import { MessageList, MessageListProps } from './MessageList'
import { RagPreviewTab, RagFullContentState } from './RagReferencePreviewPanel'

export interface ChatInterfaceProps {
  initialMessages?: Message[]
  onTaskCreate?: (task: SubtaskItem) => void
  sessionId?: string | null
  onSessionChange?: (sessionId: string) => void
}

export function ChatInterface({
  initialMessages = [],
  onTaskCreate,
  sessionId,
  onSessionChange
}: ChatInterfaceProps) {
  // ==================== State ====================
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { user: authUser } = useAuth()

  // Model selection state
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [availableModels, setAvailableModels] = useState<Array<{ id: string, name: string }>>([])
  const [modelError, setModelError] = useState<string | null>(null)

  // Task selector state
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([])
  const [taskMessageId, setTaskMessageId] = useState<string | null>(null)

  // Time helper state
  const [showTimeHelper, setShowTimeHelper] = useState(false)

  // Suggested events state
  const [suggestedEvents, setSuggestedEvents] = useState<SuggestedCalendarEvent[]>([])
  const [_eventMessageId, setEventMessageId] = useState<string | null>(null)

  // Task decomposition state
  const [taskDecomposition, setTaskDecomposition] = useState<TaskDecomposition | null>(null)
  const [decompositionMessageId, setDecompositionMessageId] = useState<string | null>(null)
  const [multiTaskDecompositions, setMultiTaskDecompositions] = useState<TaskDecomposition[] | null>(null)
  const [expandedDecompositionId, setExpandedDecompositionId] = useState<string | null>(null)

  // Feature toggles
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [_timingStrategy, setTimingStrategy] = useState<TimingStrategy | null>(null)
  const [_taskAnalysis, setTaskAnalysis] = useState<TaskAnalysis | null>(null)

  // RAG reference preview state
  const [selectedReference, setSelectedReference] = useState<RagReference | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<RagPreviewTab>('snippets')
  const [fullContentCache, setFullContentCache] = useState<Record<string, RagFullContentState>>({})
  const [fullContentLoadingPath, setFullContentLoadingPath] = useState<string | null>(null)

  // SSE streaming state
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [_streamingMetadata, setStreamingMetadata] = useState<Record<string, unknown> | null>(null)
  const [useStreaming, setUseStreaming] = useState(true)
  const [lastEventId, setLastEventId] = useState<string | null>(null)

  // ==================== Callbacks ====================

  const loadFullContent = useCallback(async (reference: RagReference) => {
    const docPath = reference?.docPath
    if (!docPath) return
    if (fullContentCache[docPath] || fullContentLoadingPath === docPath) return

    setFullContentLoadingPath(docPath)
    try {
      const response = await fetch(
        API_ENDPOINTS.KNOWLEDGE.CONTENT(docPath),
        { credentials: 'include' }
      )
      const payload = await response.json()

      if (!response.ok || !payload.success) {
        const errorMessage = payload?.detail || payload?.error || `HTTP ${response.status}`
        setFullContentCache((prev) => ({
          ...prev,
          [docPath]: {
            content: '',
            truncated: false,
            charCount: 0,
            maxChars: 20000,
            error: String(errorMessage),
          },
        }))
        return
      }

      setFullContentCache((prev) => ({
        ...prev,
        [docPath]: {
          content: payload.content || '',
          truncated: Boolean(payload.truncated),
          charCount: Number(payload.charCount || 0),
          maxChars: Number(payload.maxChars || 20000),
        },
      }))
    } catch (error) {
      setFullContentCache((prev) => ({
        ...prev,
        [docPath]: {
          content: '',
          truncated: false,
          charCount: 0,
          maxChars: 20000,
          error: error instanceof Error ? error.message : '加载文档失败',
        },
      }))
    } finally {
      setFullContentLoadingPath((prev) => (prev === docPath ? null : prev))
    }
  }, [fullContentCache, fullContentLoadingPath])

  const loadProviderModels = useCallback(async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LLM_CONFIGS, {
        credentials: 'include',
        cache: 'no-store'
      })
      const result = await response.json()

      if (result.success && result.data?.configs && Array.isArray(result.data.configs)) {
        const activeConfigs = result.data.configs.filter((c: ModelConfig) => c.enabled !== false)
        const models = activeConfigs.map((c: ModelConfig) => ({
          id: c.modelId,
          name: c.name || c.modelId
        }))
        setAvailableModels(models)

        if (models.length > 0) {
          setSelectedModel(prev => {
            if (!prev || !models.find((m: { id: string, name: string }) => m.id === prev)) {
              const defaultActive = activeConfigs.find((c: ModelConfig) => c.isActive)
              if (defaultActive) return defaultActive.modelId
              return models[0].id
            }
            return prev
          })
        }
        setModelError(null)
      } else {
        setModelError(result.error || '获取模型配置列表失败')
      }
    } catch (err) {
      console.error('加载模型配置失败:', err)
      setModelError('加载模型配置失败')
    }
  }, [])

  const handleReferenceClick = useCallback((reference: RagReference) => {
    setSelectedReference(reference)
    setPreviewOpen(true)
    setActiveTab('snippets')
  }, [])

  // ==================== Effects ====================

  // Load history when sessionId changes
  useEffect(() => {
    if (sessionId) {
      const loadHistory = async () => {
        try {
          setMessages([])
          setTimingStrategy(null)
          setTaskAnalysis(null)
          setSelectedReference(null)
          setPreviewOpen(false)

          const res = await fetch(API_ENDPOINTS.CHAT.SESSION_MESSAGES(sessionId))
          const data = await res.json()

          if (data.messages && Array.isArray(data.messages)) {
            const formattedMessages: Message[] = data.messages.map((msg: MessageFromAPI) => ({
              id: msg._id,
              user_id: msg.role === 'user' ? (authUser?.id || 'anonymous') : 'ai',
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              created_at: msg.timestamp,
              taskDecomposition: msg.taskDecomposition,
              multiTaskDecompositions: msg.multiTaskDecompositions,
              suggestedEvents: msg.suggestedEvents,
              timingStrategy: msg.timingStrategy,
              taskAnalysis: msg.taskAnalysis,
              ragReferences: msg.ragReferences
            }))
            setMessages(formattedMessages)
          }
        } catch (error) {
          console.error('加载历史消息失败:', error)
        }
      }
      loadHistory()
    } else {
      setMessages([])
      setTimingStrategy(null)
      setTaskAnalysis(null)
      setSelectedReference(null)
      setPreviewOpen(false)
    }
  }, [sessionId, authUser?.id])

  // Load provider models on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await loadProviderModels()
      } catch (error) {
        console.error('加载模型配置失败:', error)
      }
    }
    initializeApp()
  }, [loadProviderModels])

  // Load full content when RAG preview tab changes
  useEffect(() => {
    if (!previewOpen || activeTab !== 'full' || !selectedReference) {
      return
    }
    loadFullContent(selectedReference)
  }, [previewOpen, activeTab, selectedReference, loadFullContent])

  const handleStreamingMessage = useCallback(async (userMessageContent: string) => {
    const streamingMsgId = generateId()
    const streamingMsg: Message = {
      id: streamingMsgId,
      user_id: authUser?.id || 'anonymous',
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    }
    setStreamingMessage(streamingMsg)
    setStreamingContent('')
    setStreamingMetadata(null)

    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      }

if (lastEventId) {
        headers['Last-Event-ID'] = lastEventId
      }

      const response = await fetch(API_ENDPOINTS.CHAT.STREAM, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: userMessageContent,
          taskId: currentTaskId,
          sessionId: sessionId,
          useWebSearch: useWebSearch,
          runtimeModelId: selectedModel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: response.statusText }))
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        const data = await response.json()
        if (data.success && data.data?.response) {
          const assistantMessage: Message = {
            id: data.data.messageId || generateId(),
            user_id: authUser?.id || 'anonymous',
            role: 'assistant',
            content: data.data.response,
            task_id: currentTaskId,
            created_at: new Date().toISOString(),
            timingStrategy: data.data.timingStrategy,
            taskAnalysis: data.data.taskAnalysis,
            taskDecomposition: data.data.taskDecomposition,
            multiTaskDecompositions: data.data.multiTaskDecompositions,
            suggestedEvents: data.data.suggestedEvents,
            ragReferences: data.data.ragReferences,
          }
          setMessages(prev => [...prev, assistantMessage])
          if (data.data?.sessionId && data.data.sessionId !== sessionId) {
            onSessionChange?.(data.data.sessionId)
          }
        } else {
          throw new Error(data.error?.message || 'Failed to get response')
        }
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body is not readable')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      let accumulatedContent = ''
      let messageId: string | null = null
      let metadata: Record<string, unknown> | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const rawEvent of events) {
          if (!rawEvent.trim() || rawEvent.startsWith(':')) continue

          const lines = rawEvent.split('\n')
          let data: string | null = null
          let eventId: string | null = null

          for (const line of lines) {
            if (line.startsWith('data:')) {
              data = line.slice(5).trim()
            } else if (line.startsWith('id:')) {
              eventId = line.slice(3).trim()
            }
          }

          if (eventId) {
            setLastEventId(eventId)
          }

          if (!data) continue

          try {
            const event = JSON.parse(data)

            switch (event.event) {
              case 'start':
                messageId = event.message_id || null
                if (event.conversation_id && event.conversation_id !== sessionId) {
                  onSessionChange?.(event.conversation_id)
                }
                break

              case 'token':
                if (event.content) {
                  accumulatedContent += event.content
                  setStreamingContent(accumulatedContent)
                }
                break

              case 'metadata':
                metadata = event.metadata || null
                setStreamingMetadata(metadata)
                if (metadata) {
                  setStreamingMessage(prev => prev ? {
                    ...prev,
                    timingStrategy: metadata?.timingStrategy as TimingStrategy,
                    taskAnalysis: metadata?.taskAnalysis as TaskAnalysis,
                    ragReferences: metadata?.ragReferences as RagReference[],
                  } : null)
                }
                break

              case 'done':
                const finalMessage: Message = {
                  id: messageId || generateId(),
                  user_id: authUser?.id || 'anonymous',
                  role: 'assistant',
                  content: accumulatedContent,
                  task_id: currentTaskId,
                  created_at: new Date().toISOString(),
                  timingStrategy: metadata?.timingStrategy as TimingStrategy,
                  taskAnalysis: metadata?.taskAnalysis as TaskAnalysis,
                  taskDecomposition: metadata?.taskDecomposition as TaskDecomposition,
                  suggestedEvents: metadata?.suggestedEvents as SuggestedCalendarEvent[],
                  ragReferences: metadata?.ragReferences as RagReference[],
                }
                setMessages(prev => [...prev, finalMessage])
                setStreamingMessage(null)
                setStreamingContent('')

                if (metadata?.taskDecomposition) {
                  setTaskDecomposition(metadata.taskDecomposition as TaskDecomposition)
                  setDecompositionMessageId(finalMessage.id)
                }
                if (metadata?.suggestedEvents && Array.isArray(metadata.suggestedEvents) && metadata.suggestedEvents.length > 0) {
                  setSuggestedEvents(metadata.suggestedEvents as SuggestedCalendarEvent[])
                  setEventMessageId(finalMessage.id)
                }
                break

              case 'error':
                throw new Error(event.error || 'Stream error')
            }
          } catch (parseError) {
            if (parseError instanceof SyntaxError) {
              console.warn('Failed to parse SSE event:', data)
            } else {
              throw parseError
            }
          }
        }
      }

      if (streamingMessage) {
        const finalMessage: Message = {
          id: messageId || generateId(),
          user_id: authUser?.id || 'anonymous',
          role: 'assistant',
          content: accumulatedContent,
          task_id: currentTaskId,
          created_at: new Date().toISOString(),
          timingStrategy: metadata?.timingStrategy as TimingStrategy,
          taskAnalysis: metadata?.taskAnalysis as TaskAnalysis,
          taskDecomposition: metadata?.taskDecomposition as TaskDecomposition,
          suggestedEvents: metadata?.suggestedEvents as SuggestedCalendarEvent[],
          ragReferences: metadata?.ragReferences as RagReference[],
        }
        setMessages(prev => [...prev, finalMessage])
        setStreamingMessage(null)
        setStreamingContent('')
      }

    } catch (error) {
      console.error('SSE streaming error:', error)
      throw error
    }
  }, [authUser?.id, currentTaskId, sessionId, useWebSearch, selectedModel, onSessionChange, lastEventId, streamingMessage])

  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      user_id: authUser?.id || 'anonymous',
      role: 'user',
      content: input.trim(),
      task_id: currentTaskId,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    const messageContent = input.trim()
    setInput('')
    setIsLoading(true)

    try {
      console.log('发送聊天请求:', {
        message: userMessage.content.substring(0, 50),
        taskId: currentTaskId,
        timestamp: new Date().toISOString(),
        useStreaming,
      })

      if (useStreaming) {
        try {
          await handleStreamingMessage(messageContent)
          setIsLoading(false)
          return
        } catch (streamError) {
          console.warn('SSE streaming failed, falling back to non-streaming:', streamError)
        }
      }

      const response = await fetch(API_ENDPOINTS.CHAT.BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageContent,
          taskId: currentTaskId,
          sessionId: sessionId,
          useWebSearch: useWebSearch,
          runtimeModelId: selectedModel
        })
      })

      if (!response.ok) {
        console.error('API响应错误:', {
          status: response.status,
          statusText: response.statusText
        })
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      const chatData = data.data?.data ?? data.data

      if (chatData?.sessionId && chatData.sessionId !== sessionId) {
        onSessionChange?.(chatData.sessionId)
      }

      if (data.success) {
        const responseContent = chatData?.response || chatData?.message || data.response || ''

        const assistantMessage: Message = {
          id: chatData?.messageId || generateId(),
          user_id: authUser?.id || 'anonymous',
          role: 'assistant',
          content: responseContent,
          task_id: currentTaskId,
          emotion_score: chatData?.emotionScore || chatData?.emotion_score,
          created_at: new Date().toISOString(),
          timingStrategy: chatData?.timingStrategy,
          taskAnalysis: chatData?.taskAnalysis,
          taskDecomposition: chatData?.taskDecomposition,
          multiTaskDecompositions: chatData?.multiTaskDecompositions,
          suggestedEvents: chatData?.suggestedEvents,
          ragReferences: chatData?.ragReferences
        }

        setMessages(prev => [...prev, assistantMessage])

        if (chatData.taskResult && chatData.taskResult.hasTasks) {
          setPendingTasks(chatData.taskResult.tasks)
          setTaskMessageId(assistantMessage.id)
        }

        if (chatData.suggestedEvents && chatData.suggestedEvents.length > 0) {
          assistantMessage.suggestedEvents = chatData.suggestedEvents
          setSuggestedEvents(chatData.suggestedEvents)
          setEventMessageId(assistantMessage.id)
        }

        if (chatData.taskDecomposition) {
          setTaskDecomposition(chatData.taskDecomposition)
          setMultiTaskDecompositions(chatData.multiTaskDecompositions || null)
          setDecompositionMessageId(assistantMessage.id)
        }

        if (chatData.task) {
          onTaskCreate?.(chatData.task)
          setCurrentTaskId(chatData.task.id)
        }
      } else {
        const errorObj = typeof data.error === 'object' ? data.error : null
        const errorDetail = errorObj?.message || errorObj?.detail || (typeof data.error === 'string' ? data.error : '未知错误')
        const errorType = errorObj?.type || 'unknown'

        let errorMessage = `抱歉，发生了一些错误：${errorDetail}`

        if (errorDetail.includes('平台尚未配置可用的 AI 模型') || errorType === 'no_model_configured') {
          errorMessage = '平台尚未配置可用的 AI 模型，请联系管理员添加。'
        } else if (errorType === 'connection' || errorDetail.includes('Connection') || errorDetail.includes('连接')) {
          errorMessage = '连接失败：请检查您的网络连接和LLM配置是否正确。如果已配置模型，请前往"个人信息"页面检查配置。'
        } else if (errorDetail.includes('API密钥') || errorDetail.includes('api key') || errorDetail.includes('API key')) {
          errorMessage = 'API密钥错误：请检查您的LLM配置中的API密钥是否正确。'
        } else if (errorDetail.includes('模型') || errorDetail.includes('model') || errorDetail.includes('Model')) {
          errorMessage = '模型配置错误：请检查您的LLM配置中的模型ID是否正确。'
        } else if (errorDetail.includes('未配置') || errorDetail.includes('未定义')) {
          errorMessage = 'LLM未配置：请前往"个人信息"页面配置您的LLM模型和API密钥。'
        }

        throw new Error(errorMessage)
      }
    } catch (error) {
      console.error('聊天API错误:', error)
      const errorMessage: Message = {
        id: generateId(),
        user_id: authUser?.id || 'anonymous',
        role: 'assistant',
        content: error instanceof Error ? error.message : '抱歉，发生了一些错误，请稍后重试',
        created_at: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }, [input, isLoading, authUser?.id, currentTaskId, sessionId, useWebSearch, selectedModel, onSessionChange, useStreaming, handleStreamingMessage, onTaskCreate])

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  const handleTaskAdded = useCallback((task: TaskItem) => {
    setPendingTasks(prev => prev.filter(t => t.title !== task.title))
    if (pendingTasks.length === 1) {
      setTaskMessageId(null)
    }
  }, [pendingTasks.length])

  const handleConfirmEvent = useCallback(async (event: SuggestedCalendarEvent, messageId?: string) => {
    if (!authUser?.id) {
      throw new Error('请先登录')
    }

    const response = await fetch(API_ENDPOINTS.CALENDAR.EVENTS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: event.title,
        description: event.description,
        start: event.start,
        end: event.end,
        type: event.type || 'other',
        priority: event.priority || 'medium',
        location: event.location,
        allDay: event.allDay || false,
        aiGenerated: true,
        resources: event.resources
      })
    })

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error || '添加日程失败')
    }

    if (messageId) {
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg
        const remaining = (msg.suggestedEvents || []).filter(e => e.title !== event.title)
        return { ...msg, suggestedEvents: remaining.length > 0 ? remaining : undefined }
      }))

      try {
        await fetch(API_ENDPOINTS.CHAT.MESSAGE(messageId), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ suggestedEvents: null })
        })
      } catch (error) {
        console.error('Failed to persist suggestedEvents removal:', error)
      }
    }

    return result.data.event
  }, [authUser?.id])

  const handleDismissEvent = useCallback((event: SuggestedCalendarEvent, messageId?: string) => {
    setSuggestedEvents(prev => prev.filter(e => e.title !== event.title))
    if (suggestedEvents.length === 1) {
      setEventMessageId(null)
    }
    if (messageId) {
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg
        const remaining = (msg.suggestedEvents || []).filter(e => e.title !== event.title)
        return { ...msg, suggestedEvents: remaining.length > 0 ? remaining : undefined }
      }))
    }
  }, [suggestedEvents.length])

  const handleConfirmDecomposition = useCallback(async (project: { name?: string; description?: string; start_date?: string }, selectedTasks: SubtaskItem[], messageId?: string) => {
    if (!authUser?.id) {
      throw new Error('请先登录')
    }

    const startDate = project?.start_date ? new Date(project.start_date) : new Date()
    let currentDate = new Date(startDate)
    let currentHour = 9

    for (const task of selectedTasks) {
      const durationHours = task.duration_hours || 1

      if (currentHour + durationHours > 18) {
        currentDate.setDate(currentDate.getDate() + 1)
        currentHour = 9
      }

      const startTime = new Date(currentDate)
      startTime.setHours(currentHour, 0, 0, 0)

      const endTime = new Date(startTime)
      endTime.setHours(currentHour + durationHours, 0, 0, 0)

      const response = await fetch(API_ENDPOINTS.CALENDAR.EVENTS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: task.title,
          description: task.description || `来自项目「${project?.name || '任务'}」`,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          type: 'task',
          priority: 'medium',
          allDay: false,
          aiGenerated: true,
          resources: task.resources || []
        })
      })

      const result = await response.json()
      if (!result.success) {
        console.error('添加子任务失败:', result.error)
      }

      currentHour += durationHours
    }

    console.log('🧹 handleConfirmDecomposition: clearing state, messageId =', messageId)
    setTaskDecomposition(null)
    setDecompositionMessageId(null)
    setExpandedDecompositionId(null)

    if (messageId) {
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, taskDecomposition: undefined, multiTaskDecompositions: undefined }
          : msg
      ))

      try {
        await fetch(API_ENDPOINTS.CHAT.MESSAGE(messageId), {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            taskDecomposition: null,
            multiTaskDecompositions: null
          })
        })
      } catch (error) {
        console.error('Failed to persist message state update:', error)
      }
    }

    setMessages(prev => [...prev, {
      id: generateId(),
      user_id: authUser.id,
      role: 'assistant' as const,
      content: `已成功将 ${selectedTasks.length} 个子任务添加到日历！您可以在日历页面查看和管理这些任务。`,
      created_at: new Date().toISOString()
    }])
  }, [authUser?.id])

  const handleTimeAwareTaskCreate = useCallback((taskDescription: string) => {
    console.log('时间感知任务创建:', taskDescription)
    setInput(taskDescription)
    setShowTimeHelper(false)
    setTimeout(() => {
      if (taskDescription.trim()) {
        handleSendMessage()
      }
    }, 100)
  }, [handleSendMessage])

  const handleClearChat = useCallback(() => {
    setMessages([])
    setCurrentTaskId(undefined)
    setTimingStrategy(null)
    setTaskAnalysis(null)
  }, [])

  // ==================== Render ====================

  const isEmpty = messages.length === 0

  const headerProps: ChatHeaderProps = {
    isEmpty,
    authUser,
    selectedModel,
    modelError,
    useWebSearch,
    showTimeHelper,
    useStreaming,
    onClearChat: handleClearChat,
    onToggleTimeHelper: () => setShowTimeHelper(!showTimeHelper),
    onToggleWebSearch: () => setUseWebSearch(!useWebSearch),
    onToggleStreaming: () => setUseStreaming(!useStreaming),
  }

  const messageListProps: MessageListProps = {
    messages,
    isLoading,
    streamingMessage,
    streamingContent,
    onReferenceClick: handleReferenceClick,
    onTaskCreate,
    pendingTasks,
    taskMessageId,
    onTaskAdded: handleTaskAdded,
    onConfirmEvent: handleConfirmEvent,
    onDismissEvent: handleDismissEvent,
    taskDecomposition,
    decompositionMessageId,
    multiTaskDecompositions,
    expandedDecompositionId,
    onConfirmDecomposition: handleConfirmDecomposition,
    onExpandDecomposition: setExpandedDecompositionId,
    onCancelDecomposition: (messageId: string) => {
      setTaskDecomposition(null)
      setMultiTaskDecompositions(null)
      setDecompositionMessageId(null)
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, taskDecomposition: undefined, multiTaskDecompositions: undefined }
          : msg
      ))
    },
    authUserId: authUser?.id,
  }

  const inputAreaProps: ChatInputAreaProps = {
    input,
    isLoading,
    useWebSearch,
    selectedModel,
    availableModels,
    modelError,
    onInputChange: setInput,
    onKeyPress: handleKeyPress,
    onSend: handleSendMessage,
    onToggleWebSearch: () => setUseWebSearch(!useWebSearch),
    onModelChange: setSelectedModel,
    textareaRef,
    previewOpen,
    selectedReference,
    activeTab,
    fullContentState: selectedReference?.docPath ? fullContentCache[selectedReference.docPath] : undefined,
    isFullContentLoading: fullContentLoadingPath === selectedReference?.docPath,
    onPreviewClose: () => setPreviewOpen(false),
    onTabChange: setActiveTab,
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white dark:bg-gray-950">
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <ChatHeader {...headerProps} />
        <MessageList {...messageListProps} />
        <ChatInputArea {...inputAreaProps}>
          {showTimeHelper && (
            <div className="border-t border-border bg-muted/30 p-4">
              <TimeAwareTaskInput
                onTaskCreate={handleTimeAwareTaskCreate}
              />
            </div>
          )}
        </ChatInputArea>
      </div>
    </div>
  )
}
