'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Calendar, Settings, RefreshCw, Plus, ArrowLeft } from 'lucide-react'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'
import { MonthCalendar } from '@/components/calendar/MonthCalendar'
import { DatePicker } from '@/components/calendar/DatePicker'
import { EventModal } from '@/components/calendar/EventModal'

interface CalendarEvent {
  event_id: string
  summary: string
  start_time: { timestamp: string }
  end_time: { timestamp: string }
  description?: string
  status?: string
  visibility?: string
}

export default function CalendarMonthPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // 日历状态
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  
  // 弹窗状态
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showEventModal, setShowEventModal] = useState(false)
  const [showCreateEvent, setShowCreateEvent] = useState(false)

  useEffect(() => {
    checkLoginStatus()
  }, [])

  useEffect(() => {
    if (isLoggedIn) {
      loadMonthEvents(currentDate)
    }
  }, [isLoggedIn, currentDate])

  const checkLoginStatus = () => {
    const loggedIn = FeishuTokenManager.isLoggedIn()
    setIsLoggedIn(loggedIn)
  }

  // 加载指定月份的事件
  const loadMonthEvents = async (date: Date) => {
    if (!isLoggedIn) return

    setLoading(true)
    setError(null)

    try {
      const userToken = await FeishuTokenManager.getValidAccessTokenWithRefresh()
      if (!userToken) {
        throw new Error('用户访问令牌无效，请重新登录')
      }

      // 获取月份的开始和结束时间
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59)

      // 验证时间是否有效
      if (isNaN(startOfMonth.getTime()) || isNaN(endOfMonth.getTime())) {
        throw new Error(`无效的时间范围: ${date}`)
      }

      console.log('📅 月历请求时间范围:', {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        startOfMonth: startOfMonth.toISOString(),
        endOfMonth: endOfMonth.toISOString(),
        startValid: !isNaN(startOfMonth.getTime()),
        endValid: !isNaN(endOfMonth.getTime()),
        startTimestamp: Math.floor(startOfMonth.getTime() / 1000),
        endTimestamp: Math.floor(endOfMonth.getTime() / 1000)
      })

      const response = await fetch(`/api/feishu/calendar/events?` + new URLSearchParams({
        start_time: startOfMonth.toISOString(),
        end_time: endOfMonth.toISOString(),
        user_token: userToken
      }))

      const result = await response.json()

      if (!response.ok || !result.success) {
        if (result.error?.includes('expired') || result.error?.includes('Authentication token expired')) {
          setError('登录已过期，请重新登录飞书账号')
          setIsLoggedIn(false)
          return
        }
        throw new Error(result.error || '获取月度日程失败')
      }

      setEvents(result.data.events || [])
      setSuccess(`成功加载 ${date.getFullYear()}年${date.getMonth() + 1}月的 ${result.data.events?.length || 0} 个日程`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载月度日程失败'
      
      if (errorMessage.includes('expired') || errorMessage.includes('Authentication token expired')) {
        setError('登录已过期，请重新登录飞书账号')
        setIsLoggedIn(false)
      } else {
        setError(errorMessage)
      }
      
      console.error('❌ 加载月度日程失败:', err)
    } finally {
      setLoading(false)
    }
  }

  // 处理日期选择
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    console.log('选择日期:', date.toLocaleDateString())
  }

  // 处理事件点击
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setShowEventModal(true)
  }

  // 处理创建事件
  const handleCreateEvent = (date: Date) => {
    setSelectedDate(date)
    setShowCreateEvent(true)
  }

  // 处理日期变更
  const handleDateChange = (date: Date) => {
    setCurrentDate(date)
    setSelectedDate(null)
  }

  // 刷新当前月份
  const refreshCurrentMonth = () => {
    loadMonthEvents(currentDate)
  }

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center">需要登录</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">请先登录飞书账号以查看月历</p>
            <Button onClick={() => FeishuLoginRedirect.redirectToLogin(true)}>
              前往登录
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <div>
            <h1 className="text-3xl font-bold">飞书月历视图</h1>
            <p className="text-gray-600 mt-1">查看和管理您的月度日程安排</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowDatePicker(true)}
          >
            <Settings className="w-4 h-4 mr-2" />
            选择年月
          </Button>
          <Button
            variant="outline"
            onClick={refreshCurrentMonth}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            刷新
          </Button>
        </div>
      </div>

      {/* 错误和成功提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <div className="flex items-center justify-between">
              <span>{error}</span>
              {(error.includes('登录已过期') || error.includes('expired')) && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => FeishuLoginRedirect.redirectToLogin(true)}
                  className="ml-4"
                >
                  重新登录
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription className="text-green-600">
            {success}
          </AlertDescription>
        </Alert>
      )}

      {/* 选中日期信息 */}
      {selectedDate && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="font-medium">
                    已选择: {selectedDate.toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long'
                    })}
                  </div>
                  <div className="text-sm text-gray-500">
                    该日期有 {events.filter(event => {
                      const eventDate = new Date(parseInt(event.start_time.timestamp) * 1000)
                      return eventDate.toDateString() === selectedDate.toDateString()
                    }).length} 个日程
                  </div>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleCreateEvent(selectedDate)}
              >
                <Plus className="w-4 h-4 mr-2" />
                创建日程
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 月历组件 */}
      <MonthCalendar
        events={events}
        onDateSelect={handleDateSelect}
        onEventClick={handleEventClick}
        onCreateEvent={handleCreateEvent}
        selectedDate={selectedDate}
      />

      {/* 统计信息 */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{events.length}</div>
              <div className="text-sm text-gray-500">总日程数</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {events.filter(e => e.status === 'confirmed').length}
              </div>
              <div className="text-sm text-gray-500">已确认</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">
                {events.filter(e => e.status === 'tentative').length}
              </div>
              <div className="text-sm text-gray-500">待定</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {new Set(events.map(e => new Date(parseInt(e.start_time.timestamp) * 1000).toDateString())).size}
              </div>
              <div className="text-sm text-gray-500">有日程天数</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 年月选择器弹窗 */}
      <Dialog open={showDatePicker} onOpenChange={setShowDatePicker}>
        <DialogContent className="p-0">
          <DatePicker
            selectedDate={currentDate}
            onDateChange={handleDateChange}
            onClose={() => setShowDatePicker(false)}
          />
        </DialogContent>
      </Dialog>

      {/* 事件详情弹窗 */}
      <EventModal
        event={selectedEvent}
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false)
          setSelectedEvent(null)
        }}
      />

      {/* 创建事件弹窗 */}
      <Dialog open={showCreateEvent} onOpenChange={setShowCreateEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建日程</DialogTitle>
          </DialogHeader>
          <div className="p-4">
            <p className="text-gray-600 mb-4">
              为 {selectedDate?.toLocaleDateString('zh-CN')} 创建新日程
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowCreateEvent(false)
                  window.location.href = '/feishu/calendar'
                }}
                className="flex-1"
              >
                前往创建页面
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowCreateEvent(false)}
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
