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
  ChevronRight,
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
              矩时智能助手
            </h2>
            <p className="text-sm text-white/55">
              情绪感知 · 任务拆解 · 智能陪伴
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Model selector */}
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

          {/* Calendar button */}
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

          {/* Time helper button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleTimeHelper}
            className={`rounded-2xl border border-white/10 transition-colors ${showTimeHelper ? 'bg-white/15 text-emerald-100' : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'}`}
            title="智能时间助手"
          >
            <Clock className="w-4 h-4" />
          </Button>

          {/* Web search toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleWebSearch}
            className={`rounded-2xl border border-white/10 transition-colors ${useWebSearch ? 'bg-white/15 text-sky-100' : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'}`}
            title={useWebSearch ? "已开启网页搜索" : "点击开启网页搜索"}
          >
            <Globe className="w-4 h-4" />
          </Button>

          {/* Streaming toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleStreaming}
            className={`rounded-2xl border border-white/10 transition-colors ${useStreaming ? 'bg-white/15 text-emerald-100' : 'bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'}`}
            title={useStreaming ? "已开启流式输出（打字机效果）" : "点击开启流式输出"}
          >
            <Sparkles className="w-4 h-4" />
          </Button>

          {/* Chat history button */}
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
            onClick={onClearChat}
            className="rounded-2xl border-white/10 bg-white/5 text-white/70 hover:border-red-200/40 hover:bg-red-500/10 hover:text-red-100"
            disabled={isEmpty}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清空对话
          </Button>
        </div>
      </div>
    </div>
  )
})
