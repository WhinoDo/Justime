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
import { cn } from '@/lib/utils'

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
  /** Currently bound task label */
  currentTaskLabel?: string | null
  /** UI density variant */
  density?: 'comfortable' | 'desktop'
  /** Toggle showing back navigation */
  showBackButton?: boolean
  /** Toggle showing chat history */
  showHistoryLink?: boolean
}

export const ChatHeader = memo(function ChatHeader({
  isEmpty,
  authUser,
  selectedModel,
  modelError,
  useWebSearch,
  showTimeHelper,
  useStreaming,
  currentTaskLabel,
  onClearChat,
  onToggleTimeHelper,
  onToggleWebSearch,
  onToggleStreaming,
  density = 'comfortable',
  showBackButton = true,
  showHistoryLink = true,
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

  const isDesktop = density === 'desktop'

  return (
    <div className={cn(
      'sticky top-0 z-40 border-b backdrop-blur-xl',
      isDesktop
        ? 'border-violet-200/40 bg-white/[0.58] px-4 py-2.5 text-[#171421] shadow-[0_10px_36px_rgba(112,77,171,0.08)]'
        : 'border-white/10 bg-black/10 px-4 py-4 md:px-6'
    )}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="mr-1 rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white">
                <ChevronRight className="h-5 w-5 rotate-180" />
              </Button>
            </Link>
          )}
          <div className={cn(
            'flex h-11 w-11 items-center justify-center rounded-2xl',
            isDesktop
              ? 'border border-violet-200/50 bg-white/70 shadow-sm text-violet-600'
              : 'border border-white/[0.15] bg-white/[0.15] shadow-lg shadow-black/10 text-amber-200'
          )}>
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className={cn(
              'font-bold tracking-tight',
              isDesktop ? 'text-[#171421] text-sm' : 'text-xl text-white'
            )}>
              {isDesktop ? 'Agent Console' : '矩时智能助手'}
            </h2>
            <p className={cn(
              isDesktop ? 'text-[#6d6680] text-xs' : 'text-sm text-white/[0.55]'
            )}>
              {isDesktop ? '任务推进 · 上下文检查 · 知识沉淀' : '情绪感知 · 任务拆解 · 智能陪伴'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Model selector */}
          {authUser && (
            <div className="flex items-center gap-2">
              {currentTaskLabel ? (
                <Link href="/tasks">
                  <div className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 transition-colors',
                    isDesktop
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                      : 'border-emerald-200/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/[0.15]'
                  )}>
                    <Clock className={cn('h-3 w-3', isDesktop ? 'text-emerald-600' : 'text-emerald-200')} />
                    <span className="max-w-[180px] truncate text-xs font-medium">
                      {currentTaskLabel}
                    </span>
                  </div>
                </Link>
              ) : null}
              {selectedModel ? (
                <Link href="/model-config?from=/chat">
                  <div className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 transition-colors',
                    isDesktop
                      ? 'border-violet-200/50 bg-white/70 text-[#5a4c73] hover:bg-white/80'
                      : 'border-white/10 bg-white/10 text-white/80 hover:bg-white/[0.15]'
                  )}>
                    <Bot className={cn('h-3 w-3', isDesktop ? 'text-violet-500' : 'text-blue-200')} />
                    <span className="text-xs font-medium">
                      {selectedModel}
                    </span>
                  </div>
                </Link>
              ) : (
                <Link href="/model-config?from=/chat">
                  <div className={cn(
                    'flex cursor-pointer items-center gap-1 rounded-xl border px-2.5 py-1.5 transition-colors',
                    isDesktop
                      ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                      : 'border-amber-200/20 bg-amber-500/10 text-amber-100 hover:bg-amber-500/[0.15]'
                  )}>
                    <AlertTriangle className={cn('h-3 w-3', isDesktop ? 'text-amber-500' : 'text-amber-200')} />
                    <span className="text-xs font-medium">
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
              className={cn(
                'rounded-xl border transition-colors',
                isDesktop
                  ? 'border-violet-200/50 bg-white/60 text-[#5a4c73] hover:bg-white/80 hover:text-[#171421]'
                  : 'rounded-2xl border-white/10 bg-white/5 text-amber-200 hover:bg-white/10 hover:text-white'
              )}
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
            className={cn(
              'rounded-xl border transition-colors',
              isDesktop
                ? showTimeHelper
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-violet-200/50 bg-white/60 text-[#5a4c73] hover:bg-white/80 hover:text-[#171421]'
                : showTimeHelper
                  ? 'rounded-2xl border-white/10 bg-white/[0.15] text-emerald-100'
                  : 'rounded-2xl border-white/10 bg-white/5 text-white/[0.55] hover:bg-white/10 hover:text-white'
            )}
            title="智能时间助手"
          >
            <Clock className="w-4 h-4" />
          </Button>

          {/* Web search toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleWebSearch}
            className={cn(
              'rounded-xl border transition-colors',
              isDesktop
                ? useWebSearch
                  ? 'border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100'
                  : 'border-violet-200/50 bg-white/60 text-[#5a4c73] hover:bg-white/80 hover:text-[#171421]'
                : useWebSearch
                  ? 'rounded-2xl border-white/10 bg-white/[0.15] text-sky-100'
                  : 'rounded-2xl border-white/10 bg-white/5 text-white/[0.55] hover:bg-white/10 hover:text-white'
            )}
            title={useWebSearch ? "已开启网页搜索" : "点击开启网页搜索"}
          >
            <Globe className="w-4 h-4" />
          </Button>

          {/* Streaming toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleStreaming}
            className={cn(
              'rounded-xl border transition-colors',
              isDesktop
                ? useStreaming
                  ? 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100'
                  : 'border-violet-200/50 bg-white/60 text-[#5a4c73] hover:bg-white/80 hover:text-[#171421]'
                : useStreaming
                  ? 'rounded-2xl border-white/10 bg-white/[0.15] text-emerald-100'
                  : 'rounded-2xl border-white/10 bg-white/5 text-white/[0.55] hover:bg-white/10 hover:text-white'
            )}
            title={useStreaming ? "已开启流式输出（打字机效果）" : "点击开启流式输出"}
          >
            <Sparkles className="w-4 h-4" />
          </Button>

          {/* Chat history button */}
          {showHistoryLink && (
            <Link href="/chat/history">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'rounded-xl border transition-colors',
                  isDesktop
                    ? 'border-violet-200/50 bg-white/60 text-[#5a4c73] hover:bg-white/80 hover:text-[#171421]'
                    : 'rounded-2xl border-white/10 bg-white/5 text-violet-200 hover:bg-white/10 hover:text-white'
                )}
                title="查看聊天记录"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className={cn(
              'rounded-xl border transition-colors',
              isDesktop
                ? 'border-violet-200/50 bg-white/60 text-[#5a4c73] hover:bg-white/80 hover:text-[#171421]'
                : 'rounded-2xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'
            )}
          >
            {getThemeIcon()}
          </Button>
          <Button
            variant={isDesktop ? "ghost" : "outline"}
            size="sm"
            onClick={onClearChat}
            className={cn(
              'rounded-xl border transition-colors',
              isDesktop
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-50'
                : 'rounded-2xl border-white/10 bg-white/5 text-white/70 hover:border-red-200/40 hover:bg-red-500/10 hover:text-red-100'
            )}
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
