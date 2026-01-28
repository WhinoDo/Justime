'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MessageCircle,
  RefreshCw,
  Clock,
  MoreVertical
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
        setError('加载会话失败')
      }

    } catch (error) {
      console.error('加载会话失败:', error)
      setError('加载会话时发生错误')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return '今天'
    if (diffDays === 1) return '昨天'
    if (diffDays < 7) return `${diffDays}天前`
    return date.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>会话列表 ({sessions.length})</span>
            <Button onClick={loadSessions} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">暂无会话记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session._id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onSessionSelect?.(session)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <h3 className="font-medium truncate">{session.title}</h3>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(session.updatedAt)}
                        </span>
                      </div>
                      {session.preview && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-1">{session.preview}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
