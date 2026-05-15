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
import { useState, useEffect } from 'react'

interface ChatHeaderProps {
  isEmpty: boolean
  authUser: any
  selectedModel?: string
  modelError?: string | null
  useWebSearch: boolean
  showTimeHelper: boolean
  onClearChat: () => void
  onToggleTimeHelper: () => void
  onToggleWebSearch: () => void
}

export function ChatHeader({
  isEmpty,
  authUser,
  selectedModel,
  modelError,
  useWebSearch,
  showTimeHelper,
  onClearChat,
  onToggleTimeHelper,
  onToggleWebSearch
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
            onClick={onToggleTimeHelper}
            className={`transition-colors duration-200 ${showTimeHelper ? 'bg-green-100 dark:bg-green-900/30' : ''} hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400`}
            title="智能时间助手"
          >
            <Clock className="w-4 h-4" />
          </Button>

          {/* 搜索开关 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleWebSearch}
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
            onClick={onClearChat}
            className="hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors duration-200"
            disabled={isEmpty}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            清空对话
          </Button>
        </div>
      </div>
    </div>
  )
}
