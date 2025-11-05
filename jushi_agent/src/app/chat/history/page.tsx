'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { chatDB } from '@/lib/database/ChatDatabaseIntegration'
import { ChatHistoryPanel } from '@/components/chat/ChatHistoryPanel'
import { 
  MessageCircle, 
  ArrowLeft, 
  AlertTriangle,
  User,
  Bot,
  Clock
} from 'lucide-react'
import Link from 'next/link'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  metadata?: any
}

interface ChatSession {
  _id: string
  sessionId: string
  title: string
  messages: ChatMessage[]
  stats: any
  metadata: any
  createdAt: string
  updatedAt: string
}

export default function ChatHistoryPage() {
  const { isLoggedIn, userInfo } = useFeishuLogin()
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isLoggedIn) {
      initializeUser()
    } else {
      setLoading(false)
    }
  }, [isLoggedIn])

  const initializeUser = async () => {
    try {
      const user = await chatDB.initializeUser()
      setCurrentUser(user)
    } catch (error) {
      console.error('初始化用户失败:', error)
      setError('初始化用户失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSessionSelect = (session: any) => {
    console.log('选择会话:', session)
    // 这里可以实现加载会话到聊天界面的逻辑
  }

  const handleSessionLoad = async (sessionId: string) => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/database/chat-history?userId=${currentUser?.id}&sessionId=${sessionId}`
      )
      const data = await response.json()

      if (data.success) {
        setSelectedSession(data.data.session)
      } else {
        setError(data.error || '加载会话详情失败')
      }

    } catch (error) {
      console.error('加载会话详情失败:', error)
      setError('加载会话详情失败')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">加载中...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首页
              </Button>
            </Link>
          </div>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              请先登录飞书账号才能查看聊天记录。
              <Link href="/feishu/qr-login" className="ml-2 text-blue-600 hover:underline">
                点击这里登录
              </Link>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <MessageCircle className="h-8 w-8 text-blue-600" />
              聊天记录
            </h1>
            <p className="text-gray-600 mt-1">
              查看和管理您的聊天历史记录
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/">
              <Button variant="ghost">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回首页
              </Button>
            </Link>
            <Link href="/chat">
              <Button>
                <MessageCircle className="h-4 w-4 mr-2" />
                开始聊天
              </Button>
            </Link>
          </div>
        </div>

        {/* 用户信息 */}
        {userInfo && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                当前用户
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                {userInfo.avatar && (
                  <img 
                    src={userInfo.avatar} 
                    alt={userInfo.name}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <h3 className="font-medium">{userInfo.name}</h3>
                  <p className="text-sm text-gray-600">{userInfo.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 错误提示 */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 聊天记录面板 */}
          <div className="lg:col-span-2">
            <ChatHistoryPanel
              userId={currentUser?.id}
              onSessionSelect={handleSessionSelect}
              onSessionLoad={handleSessionLoad}
            />
          </div>

          {/* 会话详情面板 */}
          <div className="lg:col-span-1">
            {selectedSession ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    会话详情
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">{selectedSession.title}</h3>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>创建时间: {formatDate(selectedSession.createdAt)}</p>
                      <p>最后更新: {formatDate(selectedSession.updatedAt)}</p>
                      <p>消息数量: {selectedSession.stats.messageCount}</p>
                      <p>持续时间: {Math.floor(selectedSession.metadata.duration / 60)}分钟</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">消息预览</h4>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {selectedSession.messages.slice(0, 10).map((message) => (
                        <div key={message.id} className="text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            {message.type === 'user' ? (
                              <User className="h-3 w-3 text-blue-600" />
                            ) : (
                              <Bot className="h-3 w-3 text-green-600" />
                            )}
                            <span className="text-xs text-gray-500">
                              {formatDate(message.timestamp)}
                            </span>
                          </div>
                          <p className="text-gray-700 pl-5 line-clamp-3">
                            {message.content}
                          </p>
                        </div>
                      ))}
                      {selectedSession.messages.length > 10 && (
                        <p className="text-xs text-gray-500 text-center">
                          还有 {selectedSession.messages.length - 10} 条消息...
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <Button 
                      className="w-full" 
                      onClick={() => handleSessionSelect(selectedSession)}
                    >
                      加载到聊天界面
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8">
                    <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">选择一个会话查看详情</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 帮助信息 */}
        <Card>
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <h4 className="font-medium mb-2">功能说明</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• 查看所有聊天会话历史</li>
                  <li>• 搜索特定的对话内容</li>
                  <li>• 归档不常用的会话</li>
                  <li>• 导出聊天记录备份</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2">操作提示</h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• 点击会话可查看详细信息</li>
                  <li>• 使用搜索功能快速找到对话</li>
                  <li>• 归档的会话可以随时恢复</li>
                  <li>• 删除的会话会进入回收站</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
