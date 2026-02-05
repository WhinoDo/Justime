'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  MessageCircle,
  RefreshCw,
  Clock,
  MoreVertical,
  ChevronRight
} from 'lucide-react'

// Simplified interface based on backend response
export interface ChatSession {
  _id: string
  title: string
  updatedAt: string
  preview?: string
}

interface ChatHistoryPanelProps {
  userId?: string
  onSessionSelect?: (session: ChatSession) => void
}

export default function ChatHistoryPanel({
  userId,
  onSessionSelect
}: ChatHistoryPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      loadSessions()
    }
  }, [userId])

  const loadSessions = async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat/sessions')
      const data = await response.json()

      if (data.sessions) {
        setSessions(data.sessions)
      } else {
        setError('Failed to load sessions')
      }

    } catch (error) {
      console.error('Failed to load sessions:', error)
      setError('An error occurred while loading sessions')
    } finally {
      setLoading(false)
    }
  }

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
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-4 px-2">
        <h3 className="text-white text-lg font-semibold flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-indigo-300" />
          Conversations ({sessions.length})
        </h3>
        <Button
          onClick={loadSessions}
          variant="ghost"
          size="sm"
          className="text-white/60 hover:text-white hover:bg-white/10 h-8 rounded-lg"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* List Content */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        {loading && sessions.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-white/30" />
            <p className="text-white/40">Loading history...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-12 flex flex-col items-center">
            <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <MessageCircle className="h-8 w-8 text-white/20" />
            </div>
            <p className="text-white/40">No conversation history found.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session._id}
              className={`group relative p-4 rounded-xl transition-all duration-300 cursor-pointer border ${activeSessionId === session._id
                  ? 'bg-white/10 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                  : 'bg-black/20 hover:bg-white/10 border-white/5 hover:border-white/10'
                }`}
              onClick={() => handleSelect(session)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className={`font-semibold truncate text-sm transition-colors ${activeSessionId === session._id ? 'text-white' : 'text-white/90 group-hover:text-white'}`}>
                      {session.title || 'New Conversation'}
                    </h3>
                  </div>

                  {session.preview && (
                    <p className="text-xs text-white/50 line-clamp-1 group-hover:text-white/70 transition-colors">
                      {session.preview}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs text-white/30 font-mono">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(session.updatedAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-4 w-4 text-white/40" />
                </div>
              </div>

              {/* Selection Indicator */}
              {activeSessionId === session._id && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 bg-indigo-500 rounded-r-md shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
