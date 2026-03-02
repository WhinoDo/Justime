'use client'

import { ChatInterface } from '@/components/chat/ChatInterface'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { JushiBackground } from '@/components/ui/JushiBackground'

export default function ChatPage() {
  const { user, isLoading } = useAuth()
  const [sessionId, setSessionId] = useState<string | null>(null)

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center relative overflow-hidden">
        <JushiBackground blur="xl" />
        <div className="relative z-10 text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-white mx-auto" />
          <p className="text-sm text-white/50 tracking-widest uppercase">Loading Chat Interface</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  // 已登录用户，显示聊天界面 (带侧边栏)
  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Background Layer - Shared across sidebar and chat area for continuity */}
      <JushiBackground blur="lg" opacity={0.3} className="z-0" />

      {/* Sidebar with Glassmorphism */}
      <div className="relative z-10 hidden md:flex w-64 flex-shrink-0 flex-col border-r border-white/10 bg-black/20 backdrop-blur-xl">
        <ChatSidebar
          userId={user.id}
          currentSessionId={sessionId}
          onSelectSession={setSessionId}
          autoSelectLatest={true}
          className="flex-1 bg-transparent border-0" // Override internal styles
        />
      </div>

      {/* Main Chat Area with Glassmorphism */}
      <div className="relative z-10 flex-1 flex flex-col h-full overflow-hidden bg-white/5 backdrop-blur-3xl">
        <ChatInterface
          sessionId={sessionId}
          onSessionChange={setSessionId}
        />
      </div>
    </div>
  )
}
