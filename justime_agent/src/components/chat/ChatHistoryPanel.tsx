'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useChatSessions, type ChatSessionSummary as ChatSession } from '@/hooks/useChatSessions'
export type { ChatSession }
import {
  MessageCircle,
  RefreshCw,
  Clock,
  ChevronRight
} from 'lucide-react'

interface ChatHistoryPanelProps {
  userId?: string
  onSessionSelect?: (session: ChatSession) => void
}

export default function ChatHistoryPanel({
  userId,
  onSessionSelect
}: ChatHistoryPanelProps) {
  const { sessions, loading, error, reload } = useChatSessions({ userId })
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString()
  }

  const handleSelect = (session: ChatSession) => {
    setActiveSessionId(session._id)
    onSessionSelect?.(session)
  }

  return (
    <div className="space-y-4 text-white">
      <div className="mb-4 flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          <MessageCircle className="h-5 w-5 text-blue-200" />
          Conversations ({sessions.length})
        </h3>
        <Button
          onClick={() => void reload()}
          variant="ghost"
          size="sm"
          className="h-9 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
        {loading && sessions.length === 0 ? (
          <div className="py-12 text-center">
            <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-white/30" />
            <p className="text-white/40">Loading history...</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-6 text-center text-sm text-red-100">
            {error}
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <MessageCircle className="h-8 w-8 text-white/20" />
            </div>
            <p className="text-white/40">No conversation history found.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <button
              key={session._id}
              type="button"
              className={`group relative w-full rounded-2xl border p-4 text-left transition-all duration-300 ${activeSessionId === session._id
                  ? 'border-white/20 bg-white/[0.15] shadow-lg shadow-black/10'
                  : 'border-white/10 bg-white/5 hover:border-white/[0.15] hover:bg-white/10'
                }`}
              onClick={() => handleSelect(session)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 pr-2">
                  <div className="mb-1.5 flex items-center gap-2">
                    <h3 className={`truncate text-sm font-semibold transition-colors ${activeSessionId === session._id ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                      {session.title || 'New Conversation'}
                    </h3>
                  </div>

                  {session.preview && (
                    <p className="line-clamp-1 text-xs text-white/50 transition-colors group-hover:text-white/70">
                      {session.preview}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-3 font-mono text-xs text-white/[0.35]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(session.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center opacity-60 transition-opacity group-hover:opacity-100">
                  <ChevronRight className="h-4 w-4 text-white/[0.45]" />
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
