'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
// EmotionScoreInput removed
import { MessageBubble } from './MessageBubble'
import { Message } from '@/types'
import { generateId } from '@/lib/utils'
import { Send, Trash2, Sparkles, MessageCircle, Sun, Moon, Monitor, Clock, AlertTriangle, Settings, Bot, Calendar, ChevronRight, Globe, Brain, ListChecks, ChevronDown } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect as useEffectTheme, useState as useStateTheme } from 'react'
import Link from 'next/link'
import { TaskSelector } from './TaskSelector'
import { SuggestedEventCard } from './SuggestedEventCard'
import { SuggestedCalendarEvent } from '@/types'
import { EditableTaskPlan } from './EditableTaskPlan'
import { TaskItem } from '@/lib/ai/task-planner'
import { TimeAwareTaskInput } from './TimeAwareTaskInput'
import { TimeUtils } from '@/lib/utils/time'
import { chatDB } from '@/lib/database/ChatDatabaseIntegration'
import { ThinkingLoader } from './ThinkingLoader'
import { MessageType } from '@/types/auth'
import { useAuth } from '@/hooks/useAuth'
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ChatInterfaceProps {
  initialMessages?: Message[]
  onTaskCreate?: (task: any) => void
  sessionId?: string | null
  onSessionChange?: (sessionId: string) => void
}

export function ChatInterface({
  initialMessages = [],
  onTaskCreate,
  sessionId,
  onSessionChange
}: ChatInterfaceProps) {
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
  const [currentTime, setCurrentTime] = useState(TimeUtils.getCurrentTimeContext())
  const { user: authUser } = useAuth()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [availableModels, setAvailableModels] = useState<Array<{ id: string, name: string }>>([])
  const [modelError, setModelError] = useState<string | null>(null)
  const [suggestedEvents, setSuggestedEvents] = useState<SuggestedCalendarEvent[]>([])
  const [eventMessageId, setEventMessageId] = useState<string | null>(null)
  const [taskDecomposition, setTaskDecomposition] = useState<any>(null)
  const [decompositionMessageId, setDecompositionMessageId] = useState<string | null>(null)
  const [multiTaskDecompositions, setMultiTaskDecompositions] = useState<any[] | null>(null)
  const [expandedDecompositionId, setExpandedDecompositionId] = useState<string | null>(null)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [timingStrategy, setTimingStrategy] = useState<any | null>(null)
  const [taskAnalysis, setTaskAnalysis] = useState<any | null>(null)

  // 当 sessionId 改变时加载历史消息
  useEffect(() => {
    if (sessionId) {
      const loadHistory = async () => {
        try {
          // 清空当前消息以避免闪烁
          setMessages([])
          setTimingStrategy(null)
          setTaskAnalysis(null)

          const res = await fetch(`/api/chat/sessions/${sessionId}/messages`)
          const data = await res.json()

          if (data.messages && Array.isArray(data.messages)) {
            // 转换消息格式
            const formattedMessages: Message[] = data.messages.map((msg: any) => ({
              id: msg._id,
              user_id: msg.role === 'user' ? 'current-user' : 'ai',
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content,
              created_at: msg.timestamp,
              taskDecomposition: msg.taskDecomposition,
              multiTaskDecompositions: msg.multiTaskDecompositions,
              suggestedEvents: msg.suggestedEvents,
              timingStrategy: msg.timingStrategy,
              taskAnalysis: msg.taskAnalysis
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
    }
  }, [sessionId])

  const formatTaskType = (taskType?: string) => {
    if (taskType === 'recitation') return '背诵任务'
    if (taskType === 'thinking') return '思考任务'
    return '通用任务'
  }

  const formatUrgency = (urgency?: string) => {
    if (urgency === 'high') return '高紧急'
    if (urgency === 'low') return '低紧急'
    return '中紧急'
  }

  const formatStrategySource = (source?: string) => {
    if (source === 'llm_classifier') return '模型自动分析'
    if (source === 'heuristic_fallback') return '规则回退'
    if (source === 'explicit') return '用户指定'
    return source || '自动策略'
  }

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }



  useEffect(() => {
    scrollToBottom()
  }, [messages])



  // 更新当前时间
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(TimeUtils.getCurrentTimeContext())
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // 每分钟更新一次

    return () => clearInterval(interval)
  }, [])


  // 加载用户的LLM配置
  const loadLLMConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/llm-config', {
        credentials: 'include'
      })
      const result = await response.json()

      if (result.success && result.data?.llmConfig) {
        const config = result.data.llmConfig
        if (config.modelId && config.apiKey && config.baseUrl) {
          setSelectedModel(config.modelId)
          // 根据baseUrl判断服务商
          let provider = '自定义'
          if (config.baseUrl.includes('openai.com')) {
            provider = 'OpenAI'
          } else if (config.baseUrl.includes('dashscope')) {
            provider = '通义千问'
          } else if (config.baseUrl.includes('baidu')) {
            provider = '文心一言'
          }

          setAvailableModels([{
            id: config.modelId,
            name: `${config.modelId} (${provider})`
          }])
          setModelError(null)
        } else {
          setModelError('请先配置LLM模型')
        }
      } else {
        setModelError('未配置LLM模型')
      }
    } catch (err) {
      console.error('加载LLM配置失败:', err)
      setModelError('加载LLM配置失败')
    }
  }, [])

  useEffectTheme(() => {
    setMounted(true)

    // 初始化数据库用户会话
    const initializeDatabase = async () => {
      try {
        const user = await chatDB.initializeUser()
        console.log('✅ 数据库用户会话已初始化')

        // 加载LLM配置
        await loadLLMConfig()
      } catch (error) {
        console.error('❌ 数据库初始化失败:', error)
      }
    }

    initializeDatabase()

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

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: generateId(),
      user_id: 'current-user', // TODO: 从认证系统获取
      role: 'user',
      content: input.trim(),
      task_id: currentTaskId,
      created_at: new Date().toISOString()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    // textarea height reset removed as it is now fixed

    try {
      // 保存用户消息到数据库 (Client DB)
      const startTime = Date.now()
      await chatDB.addMessage('user', userMessage.content)

      console.log('发送聊天请求:', {
        message: userMessage.content.substring(0, 50),
        taskId: currentTaskId,
        timestamp: new Date().toISOString()
      })

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          taskId: currentTaskId,
          sessionId: sessionId, // 传递当前会话ID
          useWebSearch: useWebSearch // 是否启用网页搜索
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
          user_id: 'current-user',
          role: 'assistant',
          content: responseContent,
          task_id: currentTaskId,
          emotion_score: data.data?.emotionScore || data.data?.emotion_score,
          created_at: new Date().toISOString(),
          timingStrategy: data.data?.timingStrategy,
          taskAnalysis: data.data?.taskAnalysis,
          taskDecomposition: data.data?.taskDecomposition,
          multiTaskDecompositions: data.data?.multiTaskDecompositions,
          suggestedEvents: data.data?.suggestedEvents
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

        if (errorType === 'connection' || errorDetail.includes('Connection') || errorDetail.includes('连接')) {
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
        user_id: 'current-user',
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

    const response = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: authUser.id,
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
        await fetch(`/api/chat/messages/${messageId}`, {
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
  const handleConfirmDecomposition = async (project: any, selectedTasks: any[], messageId?: string) => {
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

      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: authUser.id,
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

    // 清空任务分解状态 (全局)
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
        await fetch(`/api/chat/messages/${messageId}`, {
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
    <div className="chat-interface flex flex-col h-screen relative bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* 聊天头部 */}
      <div className="chat-header backdrop-blur-md bg-white/70 dark:bg-black/40 border-b border-white/20 dark:border-white/10 sticky top-0 z-40 shadow-sm">
        <div className="chat-header-content">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="mr-1 text-gray-500 hover:text-gray-900">
                <ChevronRight className="w-5 h-5 rotate-180" />
              </Button>
            </Link>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                聚时智能助手
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                情绪感知 · 任务拆解 · 智能陪伴
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 模型选择器 */}
            {authUser && (
              <div className="flex items-center gap-2">
                {selectedModel ? (
                  <Link href="/model-config?from=/chat">
                    <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 transition-colors">
                      <Bot className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                        {selectedModel}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <Link href="/model-config?from=/chat">
                    <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 dark:bg-yellow-900/20 rounded-md border border-yellow-200 dark:border-yellow-800 cursor-pointer hover:bg-yellow-100 transition-colors">
                      <AlertTriangle className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
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
                className="hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors duration-200 text-orange-600 dark:text-orange-400"
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
              className="hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors duration-200 text-green-600 dark:text-green-400"
              title="智能时间助手"
            >
              <Clock className="w-4 h-4" />
            </Button>

            {/* 搜索开关 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUseWebSearch(!useWebSearch)}
              className={`transition-colors duration-200 ${useWebSearch ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500'}`}
              title={useWebSearch ? "已开启网页搜索" : "点击开启网页搜索"}
            >
              <Globe className="w-4 h-4" />
            </Button>

            {/* 聊天记录按钮 */}
            <Link href="/chat/history">
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors duration-200 text-purple-600 dark:text-purple-400"
                title="查看聊天记录"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className="hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
            >
              {getThemeIcon()}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearChat}
              className="hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors duration-200"
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
      <div className="messages-container flex-1 overflow-y-auto px-4 md:px-0 scroll-smooth">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
              <MessageCircle className="w-12 h-12 text-blue-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                开始对话
              </h3>
              <p className="text-gray-500 dark:text-gray-400 max-w-md">
                告诉我你现在的任务或感受，我会根据你的情绪状态提供个性化的帮助和任务拆解建议
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                情绪感知
              </span>
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                任务拆解
              </span>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm">
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
                      const isExpanded = expandedDecompositionId === message.id
                      const totalHours = (decomp.subtasks || []).reduce((sum: number, t: any) => sum + (t.duration_hours || 0), 0)

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
                        /* 概要时间表卡片 */
                        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                              <ListChecks className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                {decomp.project?.name || '任务分解方案'}
                              </h4>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                AI 已生成概要时间表
                              </p>
                            </div>
                          </div>

                          {decomp.project?.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                              {decomp.project.description}
                            </p>
                          )}

                          {/* 概要统计 */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                              <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                                {(decomp.subtasks || []).length}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">子任务</div>
                            </div>
                            <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                {decomp.project?.total_days || '—'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">天</div>
                            </div>
                            <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
                              <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                                {totalHours}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">总工时</div>
                            </div>
                          </div>

                          {/* 子任务预览列表 */}
                          <div className="space-y-1.5 mb-4">
                            {(decomp.subtasks || []).slice(0, 4).map((task: any, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <span className="w-5 h-5 flex items-center justify-center bg-purple-100 dark:bg-purple-800/50 text-purple-600 dark:text-purple-300 rounded text-xs font-medium">
                                  {task.order || idx + 1}
                                </span>
                                <span className="flex-1 truncate">{task.title}</span>
                                <span className="text-xs text-gray-400">{task.duration_hours}h</span>
                              </div>
                            ))}
                            {(decomp.subtasks || []).length > 4 && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                                ... 还有 {(decomp.subtasks || []).length - 4} 个子任务
                              </div>
                            )}
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => setExpandedDecompositionId(message.id)}
                              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <Calendar className="w-4 h-4 mr-2" />
                              查看详细日程安排
                              <ChevronDown className="w-4 h-4 ml-1" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
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

            {isLoading && (
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
        <div className="p-4 border-t bg-green-50/50 dark:bg-green-900/10">
          <TimeAwareTaskInput
            onTaskCreate={handleTimeAwareTaskCreate}
          />
        </div>
      )}

      {/* 底部输入区域容器 */}
      <div className="p-4 shrink-0 transition-all duration-300">
        <div className="max-w-3xl mx-auto relative rounded-2xl bg-white/30 dark:bg-white/5 border border-white/30 dark:border-white/10 shadow-sm backdrop-blur-sm overflow-hidden transition-all duration-300 focus-within:ring-2 focus-within:ring-blue-500/20">

          {/* 输入框 */}
          {/* 输入框 */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`输入 "@" 唤起常用语，或粘贴代码快速提问`}
            className="w-full h-32 px-6 py-4 bg-transparent text-gray-800 dark:text-gray-200 placeholder:text-gray-500 dark:placeholder:text-gray-400 text-base resize-none focus:outline-none overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent"
            disabled={isLoading}
          />

          {/* 底部工具栏 */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1">
            <div className="flex items-center gap-1">
              {/* 深度思考 (Toggle) */}
              <button
                onClick={() => setUseWebSearch(!useWebSearch)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${useWebSearch ? 'text-blue-600 bg-blue-500/10 dark:text-blue-400' : 'text-gray-500 hover:bg-black/5 dark:text-gray-400 dark:hover:bg-white/5'}`}
                title="启用深度思考"
              >
                <Brain className="w-4 h-4" />
                <span>深度思考</span>
              </button>
            </div>

            {/* 发送按钮 */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className={`p-2 rounded-full transition-all duration-200 ${input.trim()
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 hover:scale-105'
                  : 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            内容由 AI 生成，请仔细甄别
          </p>
        </div>
      </div>
    </div>
  )
} 
