'use client'

import { useAuth } from '@/hooks/useAuth'
import { useState, Suspense } from 'react'
import { Loader2, ListTree, Plus } from 'lucide-react'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { useDesktopCommands } from '@/hooks/useDesktopCommands'
import { DesktopAppFrame } from '@/components/layout/DesktopAppFrame'
import { DesktopCommandBar } from '@/components/layout/DesktopCommandBar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const ChatInterface = dynamic(
  () => import('@/components/chat/ChatInterface').then((mod) => mod.ChatInterface),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-sm text-white/60">Loading Chat Interface...</p>
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
        <Loader2 className="h-6 w-6 animate-spin text-white/50" />
      </div>
    ),
  }
)

function ChatPageInner() {
  const { user, isLoading } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [focusSignal, setFocusSignal] = useState(0)
  const searchParams = useSearchParams()
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
      <JustimePageShell fullHeight variant={isDesktop ? "desktop" : "immersive"} blur={isDesktop ? "none" : "xl"} opacity={isDesktop ? 0 : 0.45} contentClassName="flex items-center justify-center px-4">
        <div className={isDesktop ? "rounded-2xl border border-violet-200/[0.45] bg-white/[0.68] px-6 py-5 text-center shadow-[0_24px_80px_rgba(112,77,171,0.14)] backdrop-blur-2xl" : "rounded-3xl border border-white/10 bg-white/5 px-8 py-10 text-center backdrop-blur-xl"}>
          <div className="space-y-4">
            <Loader2 className={cn("mx-auto h-8 w-8 animate-spin", isDesktop ? "text-violet-500" : "text-white")} />
            <p className={cn("text-sm uppercase tracking-widest", isDesktop ? "text-[#8b7aa8]" : "text-white/60")}>Loading Chat Interface</p>
          </div>
        </div>
      </JustimePageShell>
    )
  }

  if (!user) {
    return null
  }

  if (isDesktop) {
    return (
      <JustimePageShell fullHeight variant="desktop" blur="none" opacity={0} contentClassName="h-full">
        <DesktopAppFrame
          title="Justime Agent"
          subtitle={taskTitle ? `绑定任务: ${taskTitle}` : 'Chat, task process, evidence, and knowledge context'}
          toolbar={
            <DesktopCommandBar>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg border border-violet-200/50 bg-white/60 px-2 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/80 hover:text-[#171421]"
                onClick={() => setSessionId(null)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New
              </Button>
              <Link href="/tasks">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg border border-violet-200/50 bg-white/60 px-2 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/80 hover:text-[#171421]"
                >
                  <ListTree className="mr-1.5 h-3.5 w-3.5" />
                  Tasks
                </Button>
              </Link>
            </DesktopCommandBar>
          }
          sidebar={
            <ChatSidebar
              userId={user.id}
              currentSessionId={sessionId}
              onSelectSession={setSessionId}
              autoSelectLatest
              variant="desktop"
              className="flex-1 border-0 bg-transparent"
            />
          }
        >
          <ChatInterface
            density="desktop"
            focusSignal={focusSignal}
            sessionId={sessionId}
            onSessionChange={setSessionId}
            initialTaskId={taskId}
            initialTaskTitle={taskTitle}
          />
        </DesktopAppFrame>
      </JustimePageShell>
    )
  }

  // 已登录用户，显示聊天界面 (带侧边栏)
  return (
    <JustimePageShell fullHeight blur="lg" opacity={0.35} contentClassName="h-full p-3 md:p-4">
      <div className="flex h-full gap-3 md:gap-4">
        <JustimeGlassPanel className="hidden w-72 flex-shrink-0 rounded-[28px] md:flex md:flex-col md:overflow-hidden">
          <ChatSidebar
            userId={user.id}
            currentSessionId={sessionId}
            onSelectSession={setSessionId}
            autoSelectLatest={true}
            className="flex-1 border-0 bg-transparent"
          />
        </JustimeGlassPanel>

        <JustimeGlassPanel className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] bg-white/[0.08]">
          <ChatInterface
            sessionId={sessionId}
            onSessionChange={setSessionId}
            initialTaskId={taskId}
            initialTaskTitle={taskTitle}
          />
        </JustimeGlassPanel>
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
