'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import {
  Sparkles,
  MessageCircle,
  Sun,
  Moon,
  Monitor,
  Clock,
  AlertTriangle,
  Bot,
  Calendar,
  Globe,
  Trash2
} from 'lucide-react'
import { useState, useEffect, memo } from 'react'

export interface ChatHeaderProps {
  /** Whether the chat is empty (no messages) */
  isEmpty: boolean
  /** Authenticated user object */
  authUser?: { id: string; name?: string; email?: string } | null
  /** Currently selected model ID */
  selectedModel?: string
  /** Error message for model loading */
  modelError?: string | null
  /** Whether web search is enabled */
  useWebSearch: boolean
  /** Whether time helper is shown */
  showTimeHelper: boolean
  /** Whether streaming mode is enabled */
  useStreaming: boolean
  /** Callback when clear chat is clicked */
  onClearChat: () => void
  /** Callback when time helper is toggled */
  onToggleTimeHelper: () => void
  /** Callback when web search is toggled */
  onToggleWebSearch: () => void
  /** Callback when streaming mode is toggled */
  onToggleStreaming: () => void
}

export const ChatHeader = memo(function ChatHeader({
  isEmpty,
  authUser,
  selectedModel,
  modelError,
  useWebSearch,
  showTimeHelper,
  useStreaming,
  onClearChat,
  onToggleTimeHelper,
  onToggleWebSearch,
  onToggleStreaming,
}: ChatHeaderProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
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

  return (
    <div className="sticky top-0 z-40 border-b border-border bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur px-4 py-3 md:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              矩时智能助手
            </h2>
            <p className="text-xs text-muted-foreground">
              情绪感知 · 任务拆解 · 智能陪伴
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Model selector */}
          {authUser && (
            <div className="flex items-center gap-1.5">
              {selectedModel ? (
                <Link href="/model-config?from=/chat">
                  <div className="flex cursor-pointer items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 transition-colors hover:bg-accent">
                    <Bot className="h-3.5 w-3.5 text-purple-500" />
                    <span className="text-xs font-medium text-foreground">
                      {selectedModel}
                    </span>
                  </div>
                </Link>
              ) : (
                <Link href="/model-config?from=/chat">
                  <div className="flex cursor-pointer items-center gap-1 rounded-md border border-amber-200/50 bg-amber-50 px-2 py-1.5 transition-colors dark:bg-amber-900/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      未配置模型
                    </span>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Calendar button */}
          <Link href="/calendar">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="日历管理"
            >
              <Calendar className="w-4 h-4" />
            </Button>
          </Link>

          {/* Time helper button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTimeHelper}
            className={`h-8 w-8 transition-colors ${showTimeHelper ? 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' : 'text-muted-foreground hover:text-foreground'}`}
            title="智能时间助手"
          >
            <Clock className="w-4 h-4" />
          </Button>

          {/* Web search toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleWebSearch}
            className={`h-8 w-8 transition-colors ${useWebSearch ? 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' : 'text-muted-foreground hover:text-foreground'}`}
            title={useWebSearch ? "已开启网页搜索" : "点击开启网页搜索"}
          >
            <Globe className="w-4 h-4" />
          </Button>

          {/* Streaming toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleStreaming}
            className={`h-8 w-8 transition-colors ${useStreaming ? 'text-purple-600 bg-purple-100 dark:bg-purple-900/30' : 'text-muted-foreground hover:text-foreground'}`}
            title={useStreaming ? "已开启流式输出（打字机效果）" : "点击开启流式输出"}
          >
            <Sparkles className="w-4 h-4" />
          </Button>

          {/* Chat history button */}
          <Link href="/chat/history">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title="查看聊天记录"
            >
              <MessageCircle className="w-4 h-4" />
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {getThemeIcon()}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearChat}
            className="h-8 text-xs text-muted-foreground hover:text-red-600 hover:border-red-200"
            disabled={isEmpty}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            清空对话
          </Button>
        </div>
      </div>
    </div>
  )
})
