'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  MessageCircle, 
  Search, 
  Archive, 
  Trash2, 
  Download, 
  RefreshCw,
  Clock,
  User,
  Bot,
  MoreVertical,
  Eye,
  Edit,
  RotateCcw
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'

interface ChatSession {
  _id: string
  sessionId: string
  title: string
  status: 'active' | 'archived' | 'deleted'
  stats: {
    messageCount: number
    userMessageCount: number
    assistantMessageCount: number
    totalTokens: number
    averageResponseTime: number
  }
  metadata: {
    startTime: string
    lastActiveTime: string
    duration: number
    emotionTrend: string[]
    taskCount: number
  }
  settings: {
    tags: string[]
  }
  createdAt: string
  updatedAt: string
}

interface ChatHistoryPanelProps {
  userId?: string
  onSessionSelect?: (session: ChatSession) => void
  onSessionLoad?: (sessionId: string) => void
}

export function ChatHistoryPanel({ 
  userId, 
  onSessionSelect, 
  onSessionLoad 
}: ChatHistoryPanelProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ChatSession[]>([])
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active')
  const [stats, setStats] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      loadSessions()
      loadStats()
    }
  }, [userId, activeTab])

  const loadSessions = async () => {
    if (!userId) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/database/chat-history?userId=${userId}&status=${activeTab}&limit=50`
      )
      const data = await response.json()

      if (data.success) {
        setSessions(data.data.sessions || [])
      } else {
        setError(data.error || '加载会话失败')
      }

    } catch (error) {
      console.error('加载会话失败:', error)
      setError('加载会话时发生错误')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!userId) return

    try {
      const response = await fetch(`/api/database/chat-history/stats?userId=${userId}`)
      const data = await response.json()

      if (data.success) {
        setStats(data.data.stats)
      }

    } catch (error) {
      console.error('加载统计信息失败:', error)
    }
  }

  const searchSessions = async () => {
    if (!userId || !searchQuery.trim()) {
      setSearchResults([])
      return
    }

    try {
      const response = await fetch(
        `/api/database/chat-history/search?userId=${userId}&query=${encodeURIComponent(searchQuery)}`
      )
      const data = await response.json()

      if (data.success) {
        setSearchResults(data.data.sessions || [])
      }

    } catch (error) {
      console.error('搜索会话失败:', error)
    }
  }

  const handleSessionAction = async (sessionId: string, action: string) => {
    try {
      let response

      switch (action) {
        case 'archive':
          response = await fetch('/api/database/chat-history', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'archive', sessionId })
          })
          break

        case 'restore':
          response = await fetch('/api/database/chat-history', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'restore', sessionId })
          })
          break

        case 'delete':
          if (!confirm('确定要删除这个会话吗？删除后可以在回收站中恢复。')) return
          response = await fetch(`/api/database/chat-history?sessionId=${sessionId}`, {
            method: 'DELETE'
          })
          break

        case 'permanent_delete':
          if (!confirm('确定要永久删除这个会话吗？此操作无法撤销！')) return
          response = await fetch(`/api/database/chat-history?sessionId=${sessionId}&permanent=true`, {
            method: 'DELETE'
          })
          break

        default:
          return
      }

      const data = await response?.json()

      if (data?.success) {
        await loadSessions()
        await loadStats()
      } else {
        setError(data?.error || '操作失败')
      }

    } catch (error) {
      console.error('会话操作失败:', error)
      setError('操作失败')
    }
  }

  const exportChatHistory = async () => {
    if (!userId) return

    try {
      const response = await fetch(`/api/database/chat-history/export?userId=${userId}`)
      const data = await response.json()

      if (data.success) {
        // 创建下载链接
        const blob = new Blob([JSON.stringify(data.data, null, 2)], { 
          type: 'application/json' 
        })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `chat-history-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }

    } catch (error) {
      console.error('导出聊天记录失败:', error)
      setError('导出失败')
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`
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

  const displaySessions = searchQuery.trim() ? searchResults : sessions

  return (
    <div className="space-y-6">
      {/* 统计信息 */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              聊天统计
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.totalSessions}</div>
                <div className="text-sm text-gray-600">总会话数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.totalMessages}</div>
                <div className="text-sm text-gray-600">总消息数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.totalTokens}</div>
                <div className="text-sm text-gray-600">总Token数</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatDuration(stats.averageSessionDuration)}
                </div>
                <div className="text-sm text-gray-600">平均时长</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 搜索和操作栏 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="搜索会话标题、消息内容或标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchSessions()}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={searchSessions} variant="outline">
                <Search className="h-4 w-4 mr-2" />
                搜索
              </Button>
              <Button onClick={exportChatHistory} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                导出
              </Button>
              <Button onClick={loadSessions} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                刷新
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 标签页 */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'active' ? 'default' : 'outline'}
          onClick={() => setActiveTab('active')}
        >
          活跃会话 ({stats?.activeSessions || 0})
        </Button>
        <Button
          variant={activeTab === 'archived' ? 'default' : 'outline'}
          onClick={() => setActiveTab('archived')}
        >
          已归档 ({stats?.archivedSessions || 0})
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 会话列表 */}
      <Card>
        <CardHeader>
          <CardTitle>
            {searchQuery.trim() ? `搜索结果 (${displaySessions.length})` : '会话列表'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">加载中...</p>
            </div>
          ) : displaySessions.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {searchQuery.trim() ? '没有找到匹配的会话' : '暂无会话记录'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displaySessions.map((session) => (
                <div
                  key={session._id}
                  className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium truncate">{session.title}</h3>
                        {session.status === 'archived' && (
                          <Badge variant="secondary">已归档</Badge>
                        )}
                        {session.settings.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {session.stats.userMessageCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          {session.stats.assistantMessageCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(session.metadata.duration)}
                        </span>
                        <span>{formatDate(session.metadata.lastActiveTime)}</span>
                      </div>

                      {session.metadata.emotionTrend.length > 0 && (
                        <div className="flex gap-1 mb-2">
                          {session.metadata.emotionTrend.slice(-3).map((emotion, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {emotion}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onSessionLoad?.(session.sessionId)}>
                          <Eye className="h-4 w-4 mr-2" />
                          查看详情
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onSessionSelect?.(session)}>
                          <MessageCircle className="h-4 w-4 mr-2" />
                          加载会话
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {session.status === 'active' ? (
                          <DropdownMenuItem onClick={() => handleSessionAction(session.sessionId, 'archive')}>
                            <Archive className="h-4 w-4 mr-2" />
                            归档
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleSessionAction(session.sessionId, 'restore')}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            恢复
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          onClick={() => handleSessionAction(session.sessionId, 'delete')}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          删除
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

export default ChatHistoryPanel
