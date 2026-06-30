'use client'

import { useAuth } from '@/hooks/useAuth'
import { useState, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { StudyQuickCommands } from '@/components/study/StudyQuickCommands'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { useDesktopCommands } from '@/hooks/useDesktopCommands'
import { DesktopAppFrame } from '@/components/layout/DesktopAppFrame'
import { DesktopCommandBar } from '@/components/layout/DesktopCommandBar'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { Button } from '@/components/ui/button'
import { MessageSquare, Search, CheckSquare } from 'lucide-react'

const ChatInterface = dynamic(
  () => import('@/components/chat/ChatInterface').then((mod) => mod.ChatInterface),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading Chat Interface...</p>
        </div>
      </div>
    ),
  }
)

const ChatSidebar = dynamic(
  () => import('@/components/chat/ChatSidebar').then((mod) => mod.ChatSidebar),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
)

function ChatPageInner() {
  const { user, isLoading } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [showStudyCommands, setShowStudyCommands] = useState(true)
  const [focusSignal, setFocusSignal] = useState(0)
  const searchParams = useSearchParams()
  const isStudyMode = searchParams.get('mode') === 'study'
  const taskId = searchParams.get('taskId')
  const taskTitle = searchParams.get('taskTitle')
  const { isDesktop } = useDesktopRuntime()

  useDesktopCommands((command) => {
    if (command === 'new-chat') {
      setSessionId(null)
    }
    if (command === 'focus-chat-input') {
      setFocusSignal((val) => val + 1)
    }
    if (command === 'open-tasks') {
      window.location.href = '/tasks'
    }
  })

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground uppercase tracking-widest">Loading Chat Interface</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // 桌面端布局
  if (isDesktop) {
    return (
      <JustimePageShell fullHeight variant="desktop" blur="none" opacity={0} contentClassName="h-full">
        <DesktopAppFrame
          title="Chat"
          subtitle="AI 对话"
          sidebar={
            <ChatSidebar
              userId={user.id}
              currentSessionId={sessionId}
              onSelectSession={setSessionId}
              autoSelectLatest={true}
            />
          }
          toolbar={
            <DesktopCommandBar>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-md px-2 text-[11px] font-medium text-[#6d6680] hover:bg-violet-100/60 hover:text-[#171421]"
                onClick={() => setSessionId(null)}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">新对话</span>
                <kbd className="ml-1 rounded border border-violet-200/50 bg-white/60 px-1 font-mono text-[10px] text-[#8b7aa8]">⌘N</kbd>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-md px-2 text-[11px] font-medium text-[#6d6680] hover:bg-violet-100/60 hover:text-[#171421]"
                onClick={() => setFocusSignal((val) => val + 1)}
              >
                <Search className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">聚焦输入</span>
                <kbd className="ml-1 rounded border border-violet-200/50 bg-white/60 px-1 font-mono text-[10px] text-[#8b7aa8]">⌘L</kbd>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-md px-2 text-[11px] font-medium text-[#6d6680] hover:bg-violet-100/60 hover:text-[#171421]"
                onClick={() => { window.location.href = '/tasks' }}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">任务</span>
                <kbd className="ml-1 rounded border border-violet-200/50 bg-white/60 px-1 font-mono text-[10px] text-[#8b7aa8]">⌘⇧T</kbd>
              </Button>
            </DesktopCommandBar>
          }
        >
          <ChatInterface
            sessionId={sessionId}
            onSessionChange={setSessionId}
            density="desktop"
            focusSignal={focusSignal}
          />
        </DesktopAppFrame>
      </JustimePageShell>
    )
  }

  // 已登录用户，显示 macOS Messages 风格界面
  return (
    <JustimePageShell fullHeight>
      <div className="flex h-full gap-0 p-0">
        {/* 左侧侧边栏 - macOS 风格 */}
        <div className="hidden w-72 flex-shrink-0 rounded-[10px] min-h-0 border-r border-border md:flex md:flex-col bg-white dark:bg-gray-950">
          <ChatSidebar
            userId={user.id}
            currentSessionId={sessionId}
            onSelectSession={setSessionId}
            autoSelectLatest={true}
            className="flex-1 border-0"
          />
        </div>

        {/* 右侧对话区域 */}
        <div className="flex min-w-0 min-h-0 flex-1 flex-col rounded-[10px] overflow-hidden bg-white dark:bg-gray-950">
          <div className="mx-auto w-full max-w-5xl flex-1 flex flex-col min-h-0">
            <ChatInterface
              sessionId={sessionId}
              onSessionChange={setSessionId}
            />
            {isStudyMode && showStudyCommands && (
              <div className="border-t border-border bg-muted/30 p-4">
                <StudyQuickCommands
                  onCommand={() => setShowStudyCommands(false)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </JustimePageShell>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  )
}
