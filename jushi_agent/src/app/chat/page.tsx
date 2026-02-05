'use client'

import { ChatInterface } from '@/components/chat/ChatInterface'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { JushiBackground } from '@/components/ui/JushiBackground'

export default function ChatPage() {
  const { user, isLoading, isAuthenticated } = useAuth()
  const router = useRouter()
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

  // 如果未登录，显示提示页面
  if (!isAuthenticated || !user) {
    return (
      <div className="h-screen flex items-center justify-center relative overflow-hidden">
        <JushiBackground blur="lg" opacity={0.6} />

        <div className="relative z-10 w-full max-w-md mx-auto text-center space-y-6 p-8 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl animate-in fade-in zoom-in-95">
          <div className="space-y-4">
            <div className="h-20 w-20 mx-auto rounded-full bg-yellow-500/20 flex items-center justify-center ring-1 ring-yellow-500/40">
              <AlertCircle className="h-10 w-10 text-yellow-300" />
            </div>
            <h2 className="text-2xl font-bold text-white">Login Required</h2>
            <p className="text-white/70 leading-relaxed">
              Please sign in to access the AI Chat Assistant and save your conversations history.
            </p>
          </div>

          <div className="space-y-3 pt-4">
            <Link href="/auth?mode=login" className="block">
              <Button className="w-full h-11 bg-white text-gray-900 border-0 hover:bg-white/90 font-medium rounded-xl">
                Sign In
              </Button>
            </Link>

            <Link href="/auth?mode=register" className="block">
              <Button variant="outline" className="w-full h-11 bg-white/5 border-white/20 text-white hover:bg-white/10 rounded-xl">
                Create Account
              </Button>
            </Link>

            <Link href="/" className="block">
              <Button variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
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