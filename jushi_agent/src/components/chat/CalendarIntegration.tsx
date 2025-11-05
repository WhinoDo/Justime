'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Plus, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

interface CalendarEvent {
  event_id: string
  summary: string
  start_time: { timestamp: string }
  end_time: { timestamp: string }
  description?: string
}

interface CalendarIntegrationProps {
  onEventCreate?: (event: any) => void
}

export function CalendarIntegration({ onEventCreate }: CalendarIntegrationProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    setMounted(true)
    // 只在客户端检查登录状态
    if (typeof window !== 'undefined') {
      setIsLoggedIn(FeishuTokenManager.isLoggedIn())
    }
  }, [])

  const loadTodayEvents = async () => {
    if (!isLoggedIn) return

    setLoading(true)
    setError(null)
    
    try {
      const userToken = FeishuTokenManager.getValidAccessToken()
      if (!userToken) {
        throw new Error('用户访问令牌无效，请重新登录')
      }

      const response = await fetch(`/api/feishu/calendar/events?type=today&user_token=${encodeURIComponent(userToken)}`)
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || '获取今日日程失败')
      }
      
      setEvents(result.data.events)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载日程失败')
      console.error('❌ 加载今日日程失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatEventTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000)
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    })
  }

  // 在组件挂载前显示加载状态
  if (!mounted) {
    return (
      <Card className="border-gray-200 bg-gray-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-5 h-5" />
            飞书日程管理
          </CardTitle>
          <CardDescription>正在加载...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!isLoggedIn) {
    return (
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <Calendar className="w-5 h-5" />
            飞书日程管理
          </CardTitle>
          <CardDescription>
            登录飞书账号以查看和管理您的日程
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            className="w-full"
            onClick={() => FeishuLoginRedirect.redirectToLogin(true)}
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            登录飞书
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Calendar className="w-5 h-5" />
          今日日程
        </CardTitle>
        <CardDescription>
          查看您今天的飞书日程安排
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={loadTodayEvents}
            disabled={loading}
            size="sm"
            className="flex-1"
          >
            {loading ? (
              <>
                <Clock className="w-4 h-4 mr-2 animate-spin" />
                加载中...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4 mr-2" />
                刷新日程
              </>
            )}
          </Button>
          
          <Link href="/feishu/calendar">
            <Button variant="outline" size="sm">
              <ExternalLink className="w-4 h-4 mr-2" />
              管理日程
            </Button>
          </Link>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {error}
          </div>
        )}

        {events.length > 0 ? (
          <div className="space-y-2">
            {events.slice(0, 3).map((event) => (
              <div key={event.event_id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{event.summary}</h4>
                  {event.description && (
                    <p className="text-xs text-gray-600 mt-1">{event.description}</p>
                  )}
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="text-xs">
                    {formatEventTime(event.start_time.timestamp)} - {formatEventTime(event.end_time.timestamp)}
                  </Badge>
                </div>
              </div>
            ))}
            
            {events.length > 3 && (
              <div className="text-center">
                <Link href="/feishu/calendar">
                  <Button variant="ghost" size="sm" className="text-blue-600">
                    查看全部 {events.length} 个日程
                  </Button>
                </Link>
              </div>
            )}
          </div>
        ) : (
          !loading && !error && (
            <div className="text-center py-6 text-gray-500">
              <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">今天暂无日程安排</p>
              <Link href="/feishu/calendar">
                <Button variant="ghost" size="sm" className="mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  创建新日程
                </Button>
              </Link>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
