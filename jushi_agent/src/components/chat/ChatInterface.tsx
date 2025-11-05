'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { EmotionScoreInput } from './EmotionScoreInput'
import { MessageBubble } from './MessageBubble'
import { Message } from '@/types'
import { generateId } from '@/lib/utils'
import { Send, Trash2, Sparkles, MessageCircle, Sun, Moon, Monitor, Calendar, Clock, LogOut, AlertTriangle, Settings } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect as useEffectTheme, useState as useStateTheme } from 'react'
import Link from 'next/link'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'
import { LoginStatusListener } from '@/components/feishu/LoginStatusListener'
import { CalendarIntegration } from './CalendarIntegration'
import { TokenDebugger } from '../debug/TokenDebugger'
import { TaskSelector } from './TaskSelector'
import { TaskItem } from '@/lib/ai/task-planner'
import { TimeAwareTaskInput } from './TimeAwareTaskInput'
import { TimeUtils } from '@/lib/utils/time'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { chatDB } from '@/lib/database/ChatDatabaseIntegration'
import { MessageType } from '@/types/auth'

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
  const [mounted, setMounted] = useStateTheme(false)
  const [isFeishuLoggedIn, setIsFeishuLoggedIn] = useStateTheme(false)
  const [showDebugger, setShowDebugger] = useStateTheme(false)
  const [pendingTasks, setPendingTasks] = useState<TaskItem[]>([])
  const [taskMessageId, setTaskMessageId] = useState<string | null>(null)
  const [showTimeHelper, setShowTimeHelper] = useState(false)
  const [currentTime, setCurrentTime] = useState(TimeUtils.getCurrentTimeContext())
  const { isLoggedIn, logout } = useFeishuLogin()
  const [hasFeishuApp, setHasFeishuApp] = useState<boolean | null>(null)
  const [showAppConfigPrompt, setShowAppConfigPrompt] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)

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

  const checkFeishuAppConfig = async (userId: string) => {
    try {
      // 动态导入服务以避免在客户端加载
      const { FeishuAppService } = await import('@/lib/database/services/FeishuAppService')
      const activeApp = await FeishuAppService.getActiveApp(userId)
      setHasFeishuApp(!!activeApp)

      // 如果用户已登录但没有飞书应用配置，显示提示
      if (isLoggedIn && !activeApp) {
        setShowAppConfigPrompt(true)
      }
    } catch (error) {
      console.error('❌ 检查飞书应用配置失败:', error)
      setHasFeishuApp(false)
    }
  }

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

  useEffectTheme(() => {
    setMounted(true)

    // 初始化数据库用户会话
    const initializeDatabase = async () => {
      try {
        const user = await chatDB.initializeUser()
        console.log('✅ 数据库用户会话已初始化')

        // 检查用户是否有飞书应用配置
        if (user) {
          checkFeishuAppConfig(user.id)
          // 初始化聊天会话
          await initializeChatSession(user.id)
        }
      } catch (error) {
        console.error('❌ 数据库初始化失败:', error)
      }
    }

    initializeDatabase()

    // 延迟检查飞书登录状态，确保组件完全挂载
    const timer = setTimeout(() => {
      checkFeishuLoginStatus()
    }, 100)

    // 监听 localStorage 变化（跨标签页同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'feishu_login_session' || e.key === 'feishu_token_info') {
        console.log('🔄 检测到登录状态变化，重新检查...')
        checkFeishuLoginStatus()
      }
    }

    window.addEventListener('storage', handleStorageChange)

    return () => {
      clearTimeout(timer)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const checkFeishuLoginStatus = () => {
    if (typeof window !== 'undefined') {
      try {
        const isLoggedIn = FeishuTokenManager.isLoggedIn()
        console.log('🔍 ChatInterface 登录状态检查:', isLoggedIn)
        setIsFeishuLoggedIn(isLoggedIn)
      } catch (error) {
        console.error('❌ ChatInterface 登录状态检查失败:', error)
        setIsFeishuLoggedIn(false)
      }
    }
  }

  const handleFeishuLogin = () => {
    console.log('🔗 ChatInterface 发起飞书登录')
    // 直接使用统一的登录跳转管理器
    FeishuLoginRedirect.redirectToLogin(true)
  }

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
        hasResponse: !!data.data?.response 
      })

      if (data.success) {
        const processingTime = Date.now() - startTime

        const assistantMessage: Message = {
          id: generateId(),
          user_id: 'current-user',
          role: 'assistant',
          content: data.data.response,
          task_id: currentTaskId,
          emotion_score: data.data.emotionScore,
          created_at: new Date().toISOString()
        }

        setMessages(prev => [...prev, assistantMessage])

        // 保存AI响应到数据库
        await chatDB.addMessage('assistant', data.data.response, {
          emotionAnalysis: data.data.emotionScore ? {
            score: data.data.emotionScore,
            tags: data.data.emotionTags || [],
            context: data.data.emotionContext
          } : undefined,
          taskData: data.data.taskResult,
          processingTime,
          model: 'gpt-3.5-turbo'
        })

        // 保存AI响应到聊天记录
        await saveChatMessage(MessageType.ASSISTANT, data.data.response, {
          emotionAnalysis: data.data.emotionScore ? {
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
        throw new Error(data.error?.message || '未知错误')
      }
    } catch (error) {
      const errorMessage: Message = {
        id: generateId(),
        user_id: 'current-user',
        role: 'assistant',
        content: `抱歉，发生了一些错误：${error instanceof Error ? error.message : '请稍后重试'}`,
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

  const handleTaskAdded = (taskId: string, success: boolean) => {
    if (success) {
      // 移除已成功添加的任务
      setPendingTasks(prev => prev.filter(task => task.id !== taskId))

      // 如果所有任务都已处理，清除任务消息关联
      if (pendingTasks.length === 1) {
        setTaskMessageId(null)
      }

      console.log(`任务 ${taskId} 已成功添加到飞书日历`)
    } else {
      console.error(`任务 ${taskId} 添加失败`)
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
            {/* 日程管理按钮 */}
            {isFeishuLoggedIn ? (
              <Link href="/feishu/calendar">
                <Button
                  variant="ghost"
                  size="sm"
                  className="hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200 text-blue-600 dark:text-blue-400"
                  title="飞书日程管理"
                >
                  <Calendar className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFeishuLogin}
                className="hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors duration-200 text-orange-600 dark:text-orange-400"
                title="登录飞书以使用日程管理"
              >
                <Calendar className="w-4 h-4" />
              </Button>
            )}

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

            {/* 聊天记录按钮 - 仅在已登录时显示 */}
            {isLoggedIn && (
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
            )}

            {/* 登出按钮 - 仅在已登录时显示 */}
            {isLoggedIn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (confirm('确定要登出飞书账号吗？')) {
                    logout()
                    alert('已成功登出')
                    // 刷新页面以确保状态完全更新
                    setTimeout(() => {
                      window.location.reload()
                    }, 500)
                  }
                }}
                className="hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors duration-200 text-red-600 dark:text-red-400"
                title="登出飞书账号"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}

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

            {/* 开发模式调试按钮 */}
            {process.env.NODE_ENV === 'development' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebugger(!showDebugger)}
                className="hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors duration-200 text-yellow-600 dark:text-yellow-400"
                title="Token 调试器"
              >
                🔍
              </Button>
            )}
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
              {isFeishuLoggedIn && (
                <Link href="/feishu/calendar">
                  <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm hover:bg-orange-200 dark:hover:bg-orange-800/40 transition-colors cursor-pointer">
                    📅 日程管理
                  </span>
                </Link>
              )}
            </div>

            {/* 飞书应用配置提示 */}
            {showAppConfigPrompt && hasFeishuApp === false && (
              <div className="max-w-md mx-auto">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-yellow-800">需要配置飞书应用</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        要使用日程管理功能，请先配置您的飞书应用信息
                      </p>
                      <div className="flex gap-2 mt-3">
                        <Link href="/feishu/app-config">
                          <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700">
                            <Settings className="h-4 w-4 mr-1" />
                            立即配置
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowAppConfigPrompt(false)}
                          className="text-yellow-700 hover:text-yellow-800"
                        >
                          稍后配置
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 日程管理组件 */}
            <div className="max-w-md mx-auto">
              <CalendarIntegration />
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

      {/* Token 调试器 */}
      {showDebugger && process.env.NODE_ENV === 'development' && (
        <div className="p-4 border-t bg-yellow-50/50 dark:bg-yellow-900/10">
          <TokenDebugger />
        </div>
      )}

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