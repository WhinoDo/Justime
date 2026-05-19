'use client'

import { useState, useRef, useEffect, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Message, RagReference, SuggestedCalendarEvent, TaskDecomposition, TimingStrategy, TaskAnalysis, SubtaskItem, MessageFromAPI, ModelConfig } from '@/types'
import { MessageType } from '@/types/auth'
import { generateId } from '@/lib/utils'
import { Send, Trash2, Sparkles, MessageCircle, Sun, Moon, Monitor, Clock, AlertTriangle, Bot, Calendar, ChevronRight, Globe, Brain, ListChecks, ChevronDown, Loader2 } from 'lucide-react'
import { TaskSelector } from './TaskSelector'
import { SuggestedEventCard } from './SuggestedEventCard'
import { EditableTaskPlan } from './EditableTaskPlan'
import { TaskItem } from '@/lib/ai/task-planner'
import { TimeAwareTaskInput } from './TimeAwareTaskInput'
import { ThinkingLoader } from './ThinkingLoader'
import { RagReferencePreviewPanel, RagPreviewTab, RagFullContentState } from './RagReferencePreviewPanel'
import { useAuth } from '@/hooks/useAuth'
import { API_ENDPOINTS } from '@/lib/api/endpoints'
import { useSSEChat } from '@/hooks/useSSEChat'
import { TypewriterMessage } from './TypewriterMessage'

const MessageBubble = dynamic(
  () => import('./MessageBubble').then((mod) => mod.MessageBubble),
  {
    ssr: false,
    loading: () => (
      <div className="flex gap-3 max-w-[85%] mr-auto animate-pulse">
        <div className="h-8 w-8 rounded-full bg-white/10" />
        <div className="flex-1 space-y-2 py-2">
          <div className="h-4 w-3/4 rounded bg-white/10" />
          <div className="h-4 w-1/2 rounded bg-white/10" />
        </div>
      </div>
    ),
  }
)

interface ChatInterfaceProps {
  initialMessages?: Message[]
  onTaskCreate?: (task: SubtaskItem) => void
  sessionId?: string | null
  onSessionChange?: (sessionId: string) => void
}

const ChatInterfaceInner = ({
  initialMessages = [],
  onTaskCreate,
  sessionId,
  onSessionChange
}: ChatInterfaceProps) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  // Emotion state removed
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([])
  const [taskMessageId, setTaskMessageId] = useState<string | null>(null)
  const [showTimeHelper, setShowTimeHelper] = useState(false)
  const { user: authUser } = useAuth()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [availableModels, setAvailableModels] = useState<Array<{ id: string, name: string }>>([])
  const [modelError, setModelError] = useState<string | null>(null)
  const [suggestedEvents, setSuggestedEvents] = useState<SuggestedCalendarEvent[]>([])
  const [eventMessageId, setEventMessageId] = useState<string | null>(null)
  const [taskDecomposition, setTaskDecomposition] = useState<TaskDecomposition | null>(null)
  const [decompositionMessageId, setDecompositionMessageId] = useState<string | null>(null)
  const [multiTaskDecompositions, setMultiTaskDecompositions] = useState<TaskDecomposition[] | null>(null)
  const [expandedDecompositionId, setExpandedDecompositionId] = useState<string | null>(null)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [timingStrategy, setTimingStrategy] = useState<TimingStrategy | null>(null)
  const [taskAnalysis, setTaskAnalysis] = useState<TaskAnalysis | null>(null)
  const [selectedReference, setSelectedReference] = useState<RagReference | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<RagPreviewTab>('snippets')
  const [fullContentCache, setFullContentCache] = useState<Record<string, RagFullContentState>>({})
  const [fullContentLoadingPath, setFullContentLoadingPath] = useState<string | null>(null)

  // SSE streaming state
  const [streamingMessage, setStreamingMessage] = useState<Message | null>(null)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingMetadata, setStreamingMetadata] = useState<Record<string, unknown> | null>(null)
  const [useStreaming, setUseStreaming] = useState(true) // Toggle for streaming mode
  const [lastEventId, setLastEventId] = useState<string | null>(null) // For reconnection

  // 当 sessionId 改变时加载历史消息
  useEffect(() => {
    if (sessionId) {
      const loadHistory = async () => {
        try {
          // 清空当前消息以避免闪烁
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
      // 新会话，清空消息
      setMessages([])
      setTimingStrategy(null)
      setTaskAnalysis(null)
      setSelectedReference(null)
      setPreviewOpen(false)
    }
  }, [sessionId])

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }



  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleReferenceClick = useCallback((reference: RagReference) => {
    setSelectedReference(reference)
    setPreviewOpen(true)
    setActiveTab('snippets')
  }, [])

  const loadFullContent = useCallback(async (reference: RagReference) => {
    const docPath = reference?.docPath
    if (!docPath) {
      return
    }
    if (fullContentCache[docPath] || fullContentLoadingPath === docPath) {
      return
    }

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

  useEffect(() => {
    if (!previewOpen || activeTab !== 'full' || !selectedReference) {
      return
    }
    loadFullContent(selectedReference)
  }, [previewOpen, activeTab, selectedReference, loadFullContent])

  // 加载可用的供应商模型 (改为从后台配置的系统模型列表中加载)
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

  useEffect(() => {
    setMounted(true)

    // 加载供应商模型
    const initializeApp = async () => {
      try {
        await loadProviderModels()
      } catch (error) {
        console.error('❌ 加载模型配置失败:', error)
      }
    }

    initializeApp()

  }, [])


  const getThemeIcon = () => {
    if (!mounted) return <Monitor className="w-4 h-4" />
    switch (theme) {
      case 'light': return <Sun className="w-4 h-4" />
      case 'dark': return <Moon className="w-4 h-4" />
      default: return <Monitor className="w-4 h-4" />
    }
  }

  const toggleTheme = () => {
    if (!mounted) return
    const themes = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme || 'system')
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  /**
   * Handle SSE streaming message send
   */
  const handleStreamingMessage = useCallback(async (userMessageContent: string) => {
    // Create streaming message placeholder
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

      // Get auth token from cookie
      const rawCookieToken = document.cookie.split(';').find(c => c.trim().startsWith('access_token='))
      if (rawCookieToken) {
        const tokenValue = rawCookieToken.split('=')[1]
        if (tokenValue) {
          try {
            const decodedToken = decodeURIComponent(tokenValue)
            headers['Authorization'] = `Bearer ${decodedToken}`
          } catch {
            headers['Authorization'] = `Bearer ${tokenValue}`
          }
        }
      }

      // 断点续传：发送 Last-Event-ID 头
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

      // Check if response is SSE stream
      const contentType = response.headers.get('content-type') || ''
      if (!contentType.includes('text/event-stream')) {
        // Not a stream, handle as regular JSON response
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

      // Process SSE stream
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

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Split by double newline to get complete events
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const rawEvent of events) {
          if (!rawEvent.trim() || rawEvent.startsWith(':')) {
            // Skip heartbeat comments
            continue
          }

          // Parse SSE event
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

          // 更新 lastEventId 用于断点续传
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
                // 更新流式消息以包含元数据（用于打字机组件显示任务分析）
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
                // Finalize the message
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

                // Handle task decomposition
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

      // If we got here without a 'done' event, finalize anyway
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
      // Fall back to non-streaming
      throw error
    }
  }, [authUser?.id, currentTaskId, sessionId, useWebSearch, selectedModel, onSessionChange, lastEventId])

  const handleSendMessage = async () => {
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

    // textarea height reset removed as it is now fixed

    try {
      const startTime = Date.now()

      console.log('发送聊天请求:', {
        message: userMessage.content.substring(0, 50),
        taskId: currentTaskId,
        timestamp: new Date().toISOString(),
        useStreaming,
      })

      // Try SSE streaming first if enabled
      if (useStreaming) {
        try {
          await handleStreamingMessage(messageContent)
          setIsLoading(false)
          return
        } catch (streamError) {
          console.warn('SSE streaming failed, falling back to non-streaming:', streamError)
          // Fall through to non-streaming
        }
      }

      // Non-streaming fallback
      const response = await fetch(API_ENDPOINTS.CHAT.BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageContent,
          taskId: currentTaskId,
          sessionId: sessionId, // 传递当前会话ID
          useWebSearch: useWebSearch, // 是否启用网页搜索
          runtimeModelId: selectedModel // 将用户选择的模型 ID 发送到后端作为运行时覆盖
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
      console.log('API响应成功:', {
        success: data.success,
        hasResponse: !!data.data?.response,
        fullData: data // 完整数据用于调试
      })

      // 如果是新会话，API会返回新创建的 sessionId
      if (data.data?.sessionId && data.data.sessionId !== sessionId) {
        onSessionChange?.(data.data.sessionId)
      }

      if (data.success) {
        const processingTime = Date.now() - startTime

        // 提取响应内容，支持多种可能的数据结构
        const responseContent = data.data?.response || data.data?.message || data.response || ''

        console.log('提取的响应内容:', {
          content: responseContent.substring(0, 100),
          contentLength: responseContent.length,
          dataStructure: Object.keys(data.data || {})
        })

        const assistantMessage: Message = {
          id: data.data?.messageId || generateId(),
          user_id: authUser?.id || 'anonymous',
          role: 'assistant',
          content: responseContent,
          task_id: currentTaskId,
          emotion_score: data.data?.emotionScore || data.data?.emotion_score,
          created_at: new Date().toISOString(),
          timingStrategy: data.data?.timingStrategy,
          taskAnalysis: data.data?.taskAnalysis,
          taskDecomposition: data.data?.taskDecomposition,
          multiTaskDecompositions: data.data?.multiTaskDecompositions,
          suggestedEvents: data.data?.suggestedEvents,
          ragReferences: data.data?.ragReferences
        }

        setMessages(prev => [...prev, assistantMessage])

        // 移除 chatDB 和 saveChatMessage 的调用，改为完全依赖后端保存

        // 如果包含任务规划数据
        if (data.data.taskResult && data.data.taskResult.hasTasks) {
          setPendingTasks(data.data.taskResult.tasks)
          setTaskMessageId(assistantMessage.id)
        }



        // 如果包含AI建议的日程
        if (data.data.suggestedEvents && data.data.suggestedEvents.length > 0) {
          assistantMessage.suggestedEvents = data.data.suggestedEvents
          setSuggestedEvents(data.data.suggestedEvents)
          setEventMessageId(assistantMessage.id)
        }

        if (data.data.taskDecomposition) {
          setTaskDecomposition(data.data.taskDecomposition)
          setMultiTaskDecompositions(data.data.multiTaskDecompositions || null)
          setDecompositionMessageId(assistantMessage.id)
        }

        // Global state setters removed as we now attached directly to message
        // if (data.data?.timingStrategy) {
        //   setTimingStrategy(data.data.timingStrategy)
        // }
        // if (data.data?.taskAnalysis) {
        //   setTaskAnalysis(data.data.taskAnalysis)
        // }

        // 如果创建了新任务
        if (data.data.task) {
          onTaskCreate?.(data.data.task)
          setCurrentTaskId(data.data.task.id)
        }
      } else {
        const errorDetail = data.error?.message || data.error?.detail || '未知错误'
        const errorType = data.error?.type || 'unknown'

        // 更详细的错误信息
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
  }



  const handleTaskAdded = (task: TaskItem) => {
    // 移除已成功添加的任务
    setPendingTasks(prev => prev.filter(t => t.title !== task.title))
    // 如果所有任务都已处理，清除任务消息关联
    if (pendingTasks.length === 1) {
      setTaskMessageId(null)
    }
  }

  // 确认添加日程到日历
  const handleConfirmEvent = async (event: SuggestedCalendarEvent, messageId?: string) => {
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

    // 清除该 message 上的已确认 event
    if (messageId) {
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg
        const remaining = (msg.suggestedEvents || []).filter(e => e.title !== event.title)
        return { ...msg, suggestedEvents: remaining.length > 0 ? remaining : undefined }
      }))

      // 持久化到后端
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
  }

  // 取消日程建议
  const handleDismissEvent = (event: SuggestedCalendarEvent, messageId?: string) => {
    setSuggestedEvents(prev => prev.filter(e => e.title !== event.title))
    if (suggestedEvents.length === 1) {
      setEventMessageId(null)
    }
    // 从 message 对象中移除该 event，使卡片消失
    if (messageId) {
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg
        const remaining = (msg.suggestedEvents || []).filter(e => e.title !== event.title)
        return { ...msg, suggestedEvents: remaining.length > 0 ? remaining : undefined }
      }))
    }
  }

  // 确认任务分解方案，批量创建日程
  const handleConfirmDecomposition = async (project: { name?: string; description?: string; start_date?: string }, selectedTasks: SubtaskItem[], messageId?: string) => {
    if (!authUser?.id) {
      throw new Error('请先登录')
    }

    const startDate = project?.start_date ? new Date(project.start_date) : new Date()

    // 按顺序安排子任务时间
    let currentDate = new Date(startDate)
    let currentHour = 9 // 从早上9点开始

    for (const task of selectedTasks) {
      const durationHours = task.duration_hours || 1

      // 如果当天时间不够，移动到下一天
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

    // 更新消息列表，移除已处理的任务分解数据，使其不再显示
    if (messageId) {
      // 1. 本地立即更新 UI (Optimistic UI Update)
      setMessages(prev => prev.map(msg =>
        msg.id === messageId
          ? { ...msg, taskDecomposition: undefined, multiTaskDecompositions: undefined }
          : msg
      ))

      // 2. 调用后端 API 持久化状态
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

    // 添加成功消息
    setMessages(prev => [...prev, {
      id: generateId(),
      user_id: authUser.id,
      role: 'assistant' as const,
      type: 'assistant' as MessageType, // Ensure MessageType is imported or use string if loose
      content: `已成功将 ${selectedTasks.length} 个子任务添加到日历！您可以在日历页面查看和管理这些任务。`,
      timestamp: new Date(),
      created_at: new Date().toISOString()
    }])
  }

  const handleTimeAwareTaskCreate = (taskDescription: string) => {
    console.log('时间感知任务创建:', taskDescription)
    setInput(taskDescription)
    setShowTimeHelper(false)
    // 自动发送消息
    setTimeout(() => {
      if (taskDescription.trim()) {
        handleSendMessage()
      }
    }, 100)
  }

  const handleClearChat = () => {
    setMessages([])
    setCurrentTaskId(undefined)
    setTimingStrategy(null)
    setTaskAnalysis(null)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col text-white">
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <div className="sticky top-0 z-40 border-b border-white/10 bg-black/10 px-4 py-4 backdrop-blur-xl md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="icon" className="mr-1 rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </Button>
              </Link>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 bg-white/15 shadow-lg shadow-black/10">
                <Sparkles className="h-5 w-5 text-amber-200" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  聚时智能助手
                </h2>
                <p className="text-sm text-white/55">
                  情绪感知 · 任务拆解 · 智能陪伴
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* 模型选择器 */}
              {authUser && (
                <div className="flex items-center gap-2">
                  {selectedModel ? (
                    <Link href="/model-config?from=/chat">
                      <div className="flex cursor-pointer items-center gap-1 rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 transition-colors hover:bg-white/15">
                        <Bot className="h-3 w-3 text-blue-200" />
                        <span className="text-xs font-medium text-white/80">
                          {selectedModel}
                        </span>
                      </div>
                    </Link>
                  ) : (
                    <Link href="/model-config?from=/chat">
                      <div className="flex cursor-pointer items-center gap-1 rounded-xl border border-amber-200/20 bg-amber-500/10 px-2.5 py-1.5 transition-colors hover:bg-amber-500/15">
                        <AlertTriangle className="h-3 w-3 text-amber-200" />
                        <span className="text-xs font-medium text-amber-100">
                          未配置模型
                        </span>
                      </div>
                    </Link>
                  )}
                </div>
              )}


              {/* 日历按钮 */}
              <Link href="/calendar">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-2xl border border-white/10 bg-white/5 text-amber-200 hover:bg-white/10 hover:text-white"
                  title="日历管理"
                >
                  <Calendar className="w-4 h-4" />
                </Button>
              </Link>

              {/* 时间助手按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTimeHelper(!showTimeHelper)}
                className="rounded-2xl border border-white/10 bg-white/5 text-emerald-200 hover:bg-white/10 hover:text-white"
                title="智能时间助手"
              >
                <Clock className="w-4 h-4" />
              </Button>

              {/* 搜索开关 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseWebSearch(!useWebSearch)}
                className={`rounded-2xl border border-white/10 transition-colors ${useWebSearch ? 'bg-white/15 text-sky-100' : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'}`}
                title={useWebSearch ? "已开启网页搜索" : "点击开启网页搜索"}
              >
                <Globe className="w-4 h-4" />
              </Button>

              {/* 流式输出开关 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUseStreaming(!useStreaming)}
                className={`rounded-2xl border border-white/10 transition-colors ${useStreaming ? 'bg-white/15 text-emerald-100' : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'}`}
                title={useStreaming ? "已开启流式输出（打字机效果）" : "点击开启流式输出"}
              >
                <Sparkles className="w-4 h-4" />
              </Button>

              {/* 聊天记录按钮 */}
              <Link href="/chat/history">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-2xl border border-white/10 bg-white/5 text-violet-200 hover:bg-white/10 hover:text-white"
                  title="查看聊天记录"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </Link>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                {getThemeIcon()}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                className="rounded-2xl border-white/10 bg-white/5 text-white/70 hover:border-red-200/40 hover:bg-red-500/10 hover:text-red-100"
                disabled={isEmpty}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                清空对话
              </Button>

            </div>
          </div>
        </div>

        {/* 消息容器 */}
        {/* 消息容器 */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 scroll-smooth">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center space-y-6 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/15 bg-white/10 shadow-2xl shadow-black/10">
                <MessageCircle className="h-12 w-12 text-white/80" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-white">
                  开始对话
                </h3>
                <p className="max-w-md text-white/60">
                  告诉我你现在的任务或感受，我会根据你的情绪状态提供个性化的帮助和任务拆解建议
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/75">
                  情绪感知
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/75">
                  任务拆解
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white/75">
                  智能陪伴
                </span>
              </div>

            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={message.id || `msg-${index}`}>
                  <MessageBubble
                    message={message}
                    onTaskCreate={onTaskCreate}
                    onReferenceClick={handleReferenceClick}
                  />
                  {/* 如果这条消息包含任务，显示任务选择器 */}
                  {taskMessageId === message.id && pendingTasks.length > 0 && (
                    <TaskSelector
                      tasks={pendingTasks}
                      onTaskAdded={handleTaskAdded}
                    />
                  )}
                  {/* 如果这条消息包含日程建议，显示日程卡片 */}
                  {message.suggestedEvents && message.suggestedEvents.length > 0 && (
                    <div className="ml-11 mt-2 space-y-2">
                      {message.suggestedEvents.map((event, index) => (
                        <SuggestedEventCard
                          key={`${event.title}-${index}`}
                          event={event}
                          onConfirm={(e) => handleConfirmEvent(e, message.id)}
                          onDismiss={() => handleDismissEvent(event, message.id)}
                        />
                      ))}
                    </div>
                  )}
                  {/* 如果这条消息包含任务分解方案，显示两阶段交互 */}
                  {((message.taskDecomposition?.project) || (decompositionMessageId === message.id && taskDecomposition?.project)) && (
                    <div className="ml-11 mt-2">
                      {(() => {
                        const decomp = message.taskDecomposition || taskDecomposition
                        if (!decomp) return null
                        const isExpanded = expandedDecompositionId === message.id
                        const totalHours = (decomp.subtasks || []).reduce((sum: number, t: { duration_hours?: number }) => sum + (t.duration_hours || 0), 0)

                        return isExpanded ? (
                          <EditableTaskPlan
                            decomposition={decomp}
                            alternatives={message.multiTaskDecompositions || multiTaskDecompositions || undefined}
                            onConfirm={(project, tasks) => handleConfirmDecomposition(project, tasks, message.id)}
                            onCancel={() => {
                              setExpandedDecompositionId(null)
                            }}
                          />
                        ) : (
                          <div className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-xl shadow-black/10 backdrop-blur-xl">
                            <div className="mb-3 flex items-center gap-2">
                              <div className="rounded-xl border border-white/10 bg-white/10 p-2">
                                <ListChecks className="h-5 w-5 text-violet-200" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-white">
                                  {decomp.project?.name || '任务分解方案'}
                                </h4>
                                <p className="text-xs text-white/50">
                                  AI 已生成概要时间表
                                </p>
                              </div>
                            </div>

                            {decomp.project?.description && (
                              <p className="mb-3 line-clamp-2 text-sm text-white/65">
                                {decomp.project.description}
                              </p>
                            )}

                            <div className="mb-4 grid grid-cols-3 gap-3">
                              <div className="rounded-xl border border-white/10 bg-white/10 p-2 text-center">
                                <div className="text-lg font-bold text-white">
                                  {(decomp.subtasks || []).length}
                                </div>
                                <div className="text-xs text-white/45">子任务</div>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/10 p-2 text-center">
                                <div className="text-lg font-bold text-white">
                                  {decomp.project?.total_days || '—'}
                                </div>
                                <div className="text-xs text-white/45">天</div>
                              </div>
                              <div className="rounded-xl border border-white/10 bg-white/10 p-2 text-center">
                                <div className="text-lg font-bold text-white">
                                  {totalHours}
                                </div>
                                <div className="text-xs text-white/45">总工时</div>
                              </div>
                            </div>

                            <div className="mb-4 space-y-1.5">
                              {(decomp.subtasks || []).slice(0, 4).map((task: SubtaskItem, idx: number) => (
                                <div key={idx} className="flex items-center gap-2 text-sm text-white/80">
                                  <span className="flex h-5 w-5 items-center justify-center rounded bg-white/10 text-xs font-medium text-white/80">
                                    {task.order || idx + 1}
                                  </span>
                                  <span className="flex-1 truncate">{task.title}</span>
                                  <span className="text-xs text-white/45">{task.duration_hours}h</span>
                                </div>
                              ))}
                              {(decomp.subtasks || []).length > 4 && (
                                <div className="text-center text-xs text-white/40">
                                  ... 还有 {(decomp.subtasks || []).length - 4} 个子任务
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => setExpandedDecompositionId(message.id)}
                                className="flex-1 rounded-xl bg-white text-gray-900 hover:bg-white/90"
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                查看详细日程安排
                                <ChevronDown className="ml-1 h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="rounded-xl border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                                onClick={() => {
                                  setTaskDecomposition(null)
                                  setMultiTaskDecompositions(null)
                                  setDecompositionMessageId(null)
                                  // Also clear from message
                                  setMessages(prev => prev.map(msg =>
                                    msg.id === message.id
                                      ? { ...msg, taskDecomposition: undefined, multiTaskDecompositions: undefined }
                                      : msg
                                  ))
                                }}
                              >
                                忽略
                              </Button>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}
                </div>
              ))}

              {/* Streaming message with typewriter effect */}
              {streamingMessage && streamingContent && (
                <TypewriterMessage
                  content={streamingContent}
                  isStreaming={isLoading}
                  speed={15}
                  message={streamingMessage}
                  onReferenceClick={handleReferenceClick}
                />
              )}

              {/* Non-streaming loading indicator */}
              {isLoading && !streamingContent && (
                <div className="flex gap-3 max-w-[85%] mr-auto animate-slide-in">
                  <ThinkingLoader input={messages[messages.length - 1]?.content || ''} />
                </div>
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>


        {/* Emotion input removed */}

        {/* 时间助手区域 */}
        {showTimeHelper && (
          <div className="border-t border-white/10 bg-white/[0.03] p-4">
            <TimeAwareTaskInput
              onTaskCreate={handleTimeAwareTaskCreate}
            />
          </div>
        )}

        {/* 底部输入区域容器 */}
        <div className="relative shrink-0 p-4 transition-all duration-300 md:px-6 md:pb-6">
          {/* 悬浮的 RAG 预览面板（居中、悬浮于输入框上方） */}
          {previewOpen && selectedReference && (
            <div className="absolute bottom-[calc(100%-1rem)] left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
              <div className="h-[400px] overflow-hidden rounded-2xl border border-white/15 bg-black/40 shadow-2xl backdrop-blur-2xl">
                <RagReferencePreviewPanel
                  open={previewOpen}
                  reference={selectedReference}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  fullContentState={fullContentCache[selectedReference.docPath || ''] || undefined}
                  isFullContentLoading={fullContentLoadingPath === selectedReference.docPath}
                  onClose={() => setPreviewOpen(false)}
                  className="h-full border-none bg-transparent"
                />
              </div>
            </div>
          )}

          {/* 原本的输入大框保持完整，textarea 在该容器内 */}
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-[28px] border border-white/15 bg-white/10 shadow-2xl shadow-black/15 backdrop-blur-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-white/20">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={`输入 "@" 唤起常用语，或粘贴代码快速提问`}
              className="h-32 resize-none overflow-y-auto border-0 bg-transparent px-6 py-4 text-base text-white placeholder:text-white/45 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isLoading}
            />

            <div className="flex flex-col gap-3 border-t border-white/10 px-4 pb-4 pt-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={selectedModel}
                  onValueChange={setSelectedModel}
                >
                  <SelectTrigger className="h-9 min-w-[150px] rounded-xl border-white/10 bg-white/5 px-3 text-white shadow-none hover:bg-white/10 focus:ring-0">
                    <div className="flex items-center gap-1.5 text-xs text-white/75">
                      <Bot className={modelError ? 'h-4 w-4 text-red-300' : 'h-4 w-4 text-blue-200'} />
                      <SelectValue placeholder={modelError ? '模型拉取失败' : '加载模型中...'} />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="bottom-full left-0 mb-1 origin-bottom">
                    {availableModels.map((model) => (
                      <SelectItem key={model.id} value={model.id} className="text-xs">
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setUseWebSearch(!useWebSearch)}
                  className={`rounded-xl border border-white/10 px-3 ${useWebSearch ? 'bg-white/15 text-sky-100 hover:bg-white/20' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}
                  title="启用深度思考"
                >
                  <Brain className="mr-1.5 h-4 w-4" />
                  <span>深度思考</span>
                </Button>
              </div>

              <Button
                type="button"
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className={`rounded-xl px-4 ${input.trim()
                  ? 'bg-white text-gray-900 hover:bg-white/90'
                  : 'bg-white/10 text-white/35 hover:bg-white/10'}`}
              >
                {isLoading ? (
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-400/40 border-t-gray-900" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                发送消息
              </Button>
            </div>
          </div>
          <div className="mt-2 text-center">
            <p className="text-xs text-white/40">
              内容由 AI 生成，请仔细甄别
            </p>
          </div>
        </div>

      </div>

    </div>
  )
}

// 自定义比较函数：避免父组件状态变化导致不必要的完整重渲染
// 只在关键 props 变化时才重新渲染
const arePropsEqual = (prevProps: ChatInterfaceProps, nextProps: ChatInterfaceProps) => {
  // sessionId 变化时必须更新（会触发历史消息加载）
  if (prevProps.sessionId !== nextProps.sessionId) return false

  // initialMessages 引用变化时需要更新
  if (prevProps.initialMessages !== nextProps.initialMessages) {
    // 如果引用不同，比较数组长度和第一个/最后一个消息的 id
    const prevMsgs = prevProps.initialMessages || []
    const nextMsgs = nextProps.initialMessages || []
    if (prevMsgs.length !== nextMsgs.length) return false
    if (prevMsgs.length > 0) {
      if (prevMsgs[0].id !== nextMsgs[0].id) return false
      if (prevMsgs[prevMsgs.length - 1].id !== nextMsgs[nextMsgs.length - 1].id) return false
    }
  }

  // onTaskCreate 和 onSessionChange 通常是稳定的回调函数
  // 如果它们变化，需要重新渲染
  if (prevProps.onTaskCreate !== nextProps.onTaskCreate) return false
  if (prevProps.onSessionChange !== nextProps.onSessionChange) return false

  // 其他情况认为 props 相等，跳过重渲染
  return true
}

export const ChatInterface = memo(ChatInterfaceInner, arePropsEqual) 
