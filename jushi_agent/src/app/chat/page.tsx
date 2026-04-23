'use client'

import { ChatInterface } from '@/components/chat/ChatInterface'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { JushiGlassPanel } from '@/components/layout/JushiGlassPanel'
import { JushiPageShell } from '@/components/layout/JushiPageShell'

export default function ChatPage() {
  const { user, isLoading } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <JushiPageShell fullHeight blur="xl" contentClassName="flex items-center justify-center px-4">
        <JushiGlassPanel className="rounded-3xl px-8 py-10 text-center">
          <div className="space-y-4">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-white" />
            <p className="text-sm uppercase tracking-widest text-white/60">Loading Chat Interface</p>
          </div>
        </JushiGlassPanel>
      </JushiPageShell>
    )
  }

  if (!user) {
    return null
  }

  // 已登录用户，显示聊天界面 (带侧边栏)
  return (
    <JushiPageShell fullHeight blur="lg" opacity={0.35} contentClassName="h-full p-3 md:p-4">
      <div className="flex h-full gap-3 md:gap-4">
        <JushiGlassPanel className="hidden w-72 flex-shrink-0 rounded-[28px] md:flex md:flex-col md:overflow-hidden">
          <ChatSidebar
            userId={user.id}
            currentSessionId={sessionId}
            onSelectSession={setSessionId}
            autoSelectLatest={true}
            className="flex-1 border-0 bg-transparent"
          />
        </JushiGlassPanel>

        <JushiGlassPanel className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[32px] bg-white/8">
          <ChatInterface
            sessionId={sessionId}
            onSessionChange={setSessionId}
          />
        </JushiGlassPanel>
      </div>
    </JushiPageShell>
  )
}
