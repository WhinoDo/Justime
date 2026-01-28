'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import ChatHistoryPanel, { ChatSession } from '@/components/chat/ChatHistoryPanel'
import {
  MessageCircle,
  ArrowLeft,
  User,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function ChatHistoryPage() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth?mode=login&redirect=/chat/history')
    }
  }, [isLoading, isAuthenticated, router])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN')
  }

  if (isLoading) {
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

  if (!isAuthenticated) return null

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
        {user && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                当前用户
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl">
                  {user.displayName?.[0] || user.username?.[0] || 'U'}
                </div>
                <div>
                  <h3 className="font-medium">{user.displayName || user.username}</h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 聊天记录面板 */}
          <div className="lg:col-span-2">
            <ChatHistoryPanel
              userId={user?.id}
              onSessionSelect={setSelectedSession}
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
                      <p>最后更新: {selectedSession.updatedAt ? formatDate(selectedSession.updatedAt) : 'N/A'}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">消息概览</h4>
                    <p className="text-gray-500 text-sm">
                      {selectedSession.preview || '暂无预览'}
                    </p>
                  </div>

                  <div className="border-t pt-4">
                    <Button
                      className="w-full"
                      onClick={() => router.push(`/chat?sessionId=${selectedSession._id}`)}
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
            <div className="text-sm text-gray-600">
              <p>点击左侧列表中的会话查看详情。点击"加载到聊天界面"继续对话。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
