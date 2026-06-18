'use client'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import {
  MessageCircle,
  ArrowLeft,
  Loader2,
  Clock,
  ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import dynamic from 'next/dynamic'
import type { ChatSessionSummary } from '@/hooks/useChatSessions'

const ChatHistoryPanel = dynamic(
  () => import('@/components/chat/ChatHistoryPanel'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          <p className="text-sm text-white/60">Loading History...</p>
        </div>
      </div>
    ),
  }
)

export default function ChatHistoryPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [selectedSession, setSelectedSession] = useState<ChatSessionSummary | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth?mode=login&redirect=/chat/history')
    }
  }, [isLoading, isAuthenticated, router])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-white/50" />
          <p className="text-white/60 text-sm font-light tracking-widest uppercase">Loading History</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-background">

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl animate-in fade-in zoom-in-95 duration-700">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10 transition-colors gap-2 pl-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="tracking-wide">Back</span>
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                <MessageCircle className="h-8 w-8 text-blue-300" />
                Chat History
              </h1>
              <p className="text-white/60 text-sm mt-1">
                Review and manage your past conversations
              </p>
            </div>
          </div>

          <Link href="/chat">
            <Button className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-500/20 rounded-xl">
              <MessageCircle className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </Link>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main List Panel */}
          <div className="lg:col-span-2 space-y-6">

            {/* User Info Card */}
            {user && (
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 flex items-center gap-4 shadow-lg">
                <div className="h-14 w-14 rounded-full bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-500/40 text-blue-300 text-xl font-bold">
                  {user.displayName?.[0]?.toUpperCase() || user.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{user.displayName || user.username}</h3>
                  <p className="text-sm text-white/50">{user.email}</p>
                </div>
                <div className="ml-auto text-right text-xs text-white/40 hidden sm:block">
                  <p>Archive Access</p>
                  <p className="text-green-400">● Active</p>
                </div>
              </div>
            )}

            {/* List Component Wrapper - Note: We might need to style the inner component if it has hardcoded styles */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl min-h-[500px]">
              {/* 
                   Ideally, ChatHistoryPanel should accept className or styles to be transparent.
                   Assuming it inherits or we can wrap it. 
                   If ChatHistoryPanel uses white background internally, we might need to modify it too.
                   For now, we place it here.
                */}
              <div className="p-4">
                <ChatHistoryPanel
                  userId={user?.id}
                  onSessionSelect={setSelectedSession}
                />
              </div>
            </div>
          </div>

          {/* Details Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl sticky top-6 h-fit">
              {selectedSession ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="pb-4 border-b border-white/10">
                    <div className="flex items-center gap-2 text-blue-300 mb-2">
                      <MessageCircle className="h-5 w-5" />
                      <span className="text-xs font-bold uppercase tracking-wider">Session Details</span>
                    </div>
                    <h3 className="text-xl font-bold text-white leading-tight">{selectedSession.title}</h3>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-white/60 text-sm">
                      <Clock className="h-4 w-4" />
                      <span>Last updated: {selectedSession.updatedAt ? formatDate(selectedSession.updatedAt) : 'N/A'}</span>
                    </div>

                    <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                      <h4 className="text-xs font-bold text-white/40 uppercase mb-2">Preview</h4>
                      <p className="text-white/80 text-sm italic line-clamp-6 leading-relaxed">
                        &ldquo;{selectedSession.preview || 'No preview available...'}&rdquo;
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 bg-white text-gray-900 hover:bg-white/90 border-0 font-bold rounded-xl shadow-lg mt-4"
                    onClick={() => router.push(`/chat?sessionId=${selectedSession._id}`)}
                  >
                    <span className="mr-2">Open Chat</span>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-12 space-y-4 opacity-50">
                  <div className="h-16 w-16 rounded-2xl bg-white/5 flex items-center justify-center">
                    <MessageCircle className="h-8 w-8 text-white/50" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-medium text-white">No Selection</h3>
                    <p className="text-sm text-white/60">Select a conversation to view details</p>
                  </div>
                </div>
              )}
            </div>

            {/* Help Card */}
            <div className="mt-6 bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
              <h4 className="text-white font-medium mb-2 flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Quick Tip
              </h4>
              <p className="text-xs text-white/50 leading-relaxed">
                Chat history is automatically saved. You can verify or continue any previous session by clicking on it.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
