'use client'

import { useAuth } from '@/hooks/useAuth'
import { useState, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { StudyQuickCommands } from '@/components/study/StudyQuickCommands'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

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
  const searchParams = useSearchParams()
  const isStudyMode = searchParams.get('mode') === 'study'

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

  // 已登录用户，显示 macOS Messages 风格界面
  return (
    <div className="min-h-screen bg-background">
      <div className="h-[calc(100vh-var(--titlebar-height,0px))] flex gap-0 p-0">
        {/* 左侧侧边栏 - macOS 风格 */}
        <div className="hidden w-72 flex-shrink-0 border-r border-border md:flex md:flex-col bg-white dark:bg-gray-950">
          <ChatSidebar
            userId={user.id}
            currentSessionId={sessionId}
            onSelectSession={setSessionId}
            autoSelectLatest={true}
            className="flex-1 border-0"
          />
        </div>

        {/* 右侧对话区域 */}
        <div className="flex min-w-0 flex-1 flex-col bg-white dark:bg-gray-950">
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
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  )
}
