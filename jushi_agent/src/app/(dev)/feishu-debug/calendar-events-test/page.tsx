'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { Calendar, Clock, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react'

interface CalendarEvent {
  event_id: string
  summary: string
  description?: string
  start_time: {
    timestamp: string
    timezone?: string
  }
  end_time: {
    timestamp: string
    timezone?: string
  }
  status?: string
  visibility?: string
}

export default function CalendarEventsTestPage() {
  const { isLoggedIn, requireLogin } = useFeishuLogin()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<{
    standard: { success: boolean; error?: string; count?: number }
    official: { success: boolean; error?: string; count?: number }
    raw: { success: boolean; error?: string; count?: number }
  }>({
    standard: { success: false },
    official: { success: false },
    raw: { success: false }
  })

  const testMethod = async (method: 'standard' | 'official' | 'raw') => {
    if (!requireLogin('需要登录飞书账号才能测试日历功能')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const userToken = await FeishuTokenManager.getValidAccessTokenWithRefresh()
      if (!userToken) {
        throw new Error('无法获取有效的用户访问令牌')
      }

      let url = `/api/feishu/calendar/events?type=today&user_token=${encodeURIComponent(userToken)}`
      
      if (method === 'official') {
        url += '&official=true'
      } else if (method === 'raw') {
        url += '&raw=true'
      }

      console.log(`🧪 测试 ${method} 方法:`, url)

      const response = await fetch(url)
      const result = await response.json()

      console.log(`📊 ${method} 方法响应:`, result)

      if (!response.ok || !result.success) {
        throw new Error(result.error || `${method} 方法获取失败`)
      }

      const eventCount = result.data?.events?.length || 0
      setEvents(result.data.events || [])
      
      setTestResults(prev => ({
        ...prev,
        [method]: { success: true, count: eventCount }
      }))

      console.log(`✅ ${method} 方法测试成功，获取到 ${eventCount} 个事件`)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `${method} 方法测试失败`
      setError(errorMessage)
      
      setTestResults(prev => ({
        ...prev,
        [method]: { success: false, error: errorMessage }
      }))

      console.error(`❌ ${method} 方法测试失败:`, err)
    } finally {
      setLoading(false)
    }
  }

  const formatEventTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000)
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatEventDate = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              飞书日历事件获取测试
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                这个页面用于测试不同方法获取飞书日历事件的功能，帮助诊断和修复获取今日日程的问题。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {!isLoggedIn && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              请先登录飞书账号以测试日历功能
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 标准方法测试 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">标准方法</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => testMethod('standard')}
                disabled={!isLoggedIn || loading}
                className="w-full"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                测试标准方法
              </Button>
              
              {testResults.standard.success ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">成功 ({testResults.standard.count} 个事件)</span>
                </div>
              ) : testResults.standard.error ? (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{testResults.standard.error}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* 官方示例方法测试 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">官方示例</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => testMethod('official')}
                disabled={!isLoggedIn || loading}
                className="w-full"
                variant="outline"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                测试官方示例
              </Button>
              
              {testResults.official.success ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">成功 ({testResults.official.count} 个事件)</span>
                </div>
              ) : testResults.official.error ? (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{testResults.official.error}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* 原始HTTP方法测试 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">原始HTTP</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => testMethod('raw')}
                disabled={!isLoggedIn || loading}
                className="w-full"
                variant="secondary"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Calendar className="h-4 w-4 mr-2" />}
                测试原始HTTP
              </Button>
              
              {testResults.raw.success ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">成功 ({testResults.raw.count} 个事件)</span>
                </div>
              ) : testResults.raw.error ? (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">{testResults.raw.error}</span>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 事件列表 */}
        {events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                今日日程 ({events.length} 个)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {events.map((event, index) => (
                  <div key={event.event_id || index} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{event.summary || '无标题'}</h4>
                        {event.description && (
                          <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>
                            {formatEventDate(event.start_time.timestamp)} {formatEventTime(event.start_time.timestamp)} - {formatEventTime(event.end_time.timestamp)}
                          </span>
                          {event.status && (
                            <Badge variant="outline" className="text-xs">
                              {event.status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
