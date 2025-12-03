'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { EmotionScoreInput } from './EmotionScoreInput'
import { MessageBubble } from './MessageBubble'
import { Message } from '@/types'
import { generateId } from '@/lib/utils'
import { Send, Trash2, Sparkles, MessageCircle, Sun, Moon, Monitor, Clock, AlertTriangle, Settings, Bot, Calendar } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect as useEffectTheme, useState as useStateTheme } from 'react'
import Link from 'next/link'
import { TaskSelector } from './TaskSelector'
import { TaskItem } from '@/lib/ai/task-planner'
import { TimeAwareTaskInput } from './TimeAwareTaskInput'
import { TimeUtils } from '@/lib/utils/time'
import { chatDB } from '@/lib/database/ChatDatabaseIntegration'
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
  onEmotionUpdate?: (score: number) => void
}

export function ChatInterface({ 
  initialMessages = [], 
  onTaskCreate, 
  onEmotionUpdate 
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showEmotionInput, setShowEmotionInput] = useState(false)
  const [suggestedEmotionScore, setSuggestedEmotionScore] = useState<number | undefined>()
  const [currentTaskId, setCurrentTaskId] = useState<string | undefined>()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([])
  const [taskMessageId, setTaskMessageId] = useState<string | null>(null)
  const [showTimeHelper, setShowTimeHelper] = useState(false)
  const [currentTime, setCurrentTime] = useState(TimeUtils.getCurrentTimeContext())
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const { user: authUser } = useAuth()
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [availableModels, setAvailableModels] = useState<Array<{id: string, name: string}>>([])
  const [modelError, setModelError] = useState<string | null>(null)

  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    adjustTextareaHeight()
  }, [input])

  // 更新当前时间
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(TimeUtils.getCurrentTimeContext())
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // 每分钟更新一次

    return () => clearInterval(interval)
  }, [])


  const initializeChatSession = async (userId: string) => {
    try {
      if (!autoSaveEnabled) return

      // 获取或创建活跃会话
      const response = await fetch('/api/database/chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_or_create_active',
          userId
        })
      })

      const data = await response.json()
      if (data.success) {
        setCurrentSessionId(data.data.session.sessionId)
        console.log('✅ 聊天会话已初始化:', data.data.session.sessionId)
      }

    } catch (error) {
      console.error('❌ 初始化聊天会话失败:', error)
    }
  }

  const saveChatMessage = async (type: MessageType, content: string, metadata?: any) => {
    try {
      if (!autoSaveEnabled || !currentSessionId) return

      await fetch('/api/database/chat-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_message',
          sessionId: currentSessionId,
          type,
          content,
          options: metadata
        })
      })

    } catch (error) {
      console.error('❌ 保存聊天消息失败:', error)
    }
  }

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

        // 初始化聊天会话
        if (user) {
          await initializeChatSession(user.id)
        }

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

    // 重置textarea高度
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    try {
      // 保存用户消息到数据库
      const startTime = Date.now()
      await chatDB.addMessage('user', userMessage.content)

      // 保存用户消息到聊天记录
      await saveChatMessage(MessageType.USER, userMessage.content)

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
          taskId: currentTaskId
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
          id: generateId(),
          user_id: 'current-user',
          role: 'assistant',
          content: responseContent,
          task_id: currentTaskId,
          emotion_score: data.data?.emotionScore || data.data?.emotion_score,
          created_at: new Date().toISOString()
        }

        setMessages(prev => [...prev, assistantMessage])

        // 保存AI响应到数据库
        await chatDB.addMessage('assistant', responseContent, {
          emotionAnalysis: (data.data?.emotionScore || data.data?.emotion_score) ? {
            score: data.data?.emotionScore || data.data?.emotion_score,
            tags: data.data?.emotionTags || data.data?.emotion_tags || [],
            context: data.data.emotionContext
          } : undefined,
          taskData: data.data.taskResult,
          processingTime,
          model: 'gpt-3.5-turbo'
        })

        // 保存AI响应到聊天记录
        await saveChatMessage(MessageType.ASSISTANT, responseContent, {
          emotionAnalysis: (data.data?.emotionScore || data.data?.emotion_score) ? {
            emotion: data.data.emotionTags?.[0] || 'neutral',
            confidence: data.data.emotionScore / 10,
            suggestions: data.data.emotionContext ? [data.data.emotionContext] : undefined
          } : undefined,
          taskExtraction: data.data.taskResult?.hasTasks ? {
            tasks: data.data.taskResult.tasks.map((task: any) => ({
              title: task.title,
              description: task.description,
              priority: task.priority || 'medium',
              estimatedTime: task.estimatedTime
            }))
          } : undefined,
          responseTime: processingTime,
          tokenCount: data.data.tokenCount,
          model: 'gpt-3.5-turbo'
        })

        // 如果包含任务规划数据
        if (data.data.taskResult && data.data.taskResult.hasTasks) {
          setPendingTasks(data.data.taskResult.tasks)
          setTaskMessageId(assistantMessage.id)
        }

        // 如果需要情绪输入
        if (data.data.needsEmotionInput || data.data.emotionScore <= 6) {
          setShowEmotionInput(true)
          setSuggestedEmotionScore(data.data.emotionScore)
        }

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

  const handleEmotionSubmit = (score: number) => {
    setShowEmotionInput(false)
    onEmotionUpdate?.(score)

    // 可以在这里触发基于情绪评分的任务拆解
    if (currentTaskId) {
      // TODO: 调用任务拆解API
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
    setShowEmotionInput(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="chat-interface">
      {/* 聊天头部 */}
      <div className="chat-header">
        <div className="chat-header-content">
          <div className="flex items-center gap-3">
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
                  <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-md border border-blue-200 dark:border-blue-800">
                    <Bot className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      {selectedModel}
                    </span>
                  </div>
                ) : (
                  <Link href="/model-config">
                    <Alert className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20 py-1 px-2 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30">
                      <AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                      <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-300 ml-1">
                        未配置模型
                      </AlertDescription>
                    </Alert>
                  </Link>
                )}
                <Link href="/model-config">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200 text-blue-600 dark:text-blue-400"
                    title="配置LLM模型"
                  >
                    <Settings className="w-3 h-3 mr-1" />
                    配置
                  </Button>
                </Link>
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
      <div className="messages-container">
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
            {messages.map(message => (
              <div key={message.id}>
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
              </div>
            ))}
            
            {isLoading && (
              <div className="flex gap-3 max-w-[85%] mr-auto animate-slide-in">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
                  <Sparkles className="w-4 h-4 text-white animate-pulse" />
                </div>
                <div className="typing-indicator">
                  <span className="text-sm text-gray-600 dark:text-gray-300">AI正在思考</span>
                  <div className="flex gap-1">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        
        <div ref={messagesEndRef} />
      </div>


      {/* 情绪输入区域 */}
      {showEmotionInput && (
        <div className="emotion-input-container">
          <EmotionScoreInput
            onSubmit={handleEmotionSubmit}
            suggestedScore={suggestedEmotionScore}
          />
        </div>
      )}

      {/* 时间助手区域 */}
      {showTimeHelper && (
        <div className="p-4 border-t bg-green-50/50 dark:bg-green-900/10">
          <TimeAwareTaskInput
            onTaskCreate={handleTimeAwareTaskCreate}
          />
        </div>
      )}

      {/* 输入区域 */}
      <div className="input-form">
        <div className="input-container">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`告诉我你现在的任务或感受... (当前时间: ${currentTime.formatted.time})`}
            className="input-textarea"
            disabled={isLoading}
            rows={1}
          />
          <button 
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="send-button"
          >
            <Send className="w-4 h-4" />
            发送
          </button>
        </div>
      </div>
    </div>
  )
} 