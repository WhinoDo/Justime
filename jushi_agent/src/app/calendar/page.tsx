'use client'

import { useState, useEffect, useCallback } from 'react'
import { BigCalendar, CalendarEventData } from '@/components/calendar/BigCalendar'
import { EventDialog } from '@/components/calendar/EventDialog'
import { Button } from '@/components/ui/button'
import { Plus, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { SlotInfo } from 'react-big-calendar'

export default function CalendarPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const [events, setEvents] = useState<CalendarEventData[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)

  // 获取用户ID
  const getUserId = () => {
    if (user?.id) return user.id
    return null
  }

  // 加载事件
  const loadEvents = useCallback(async () => {
    const userId = getUserId()
    if (!userId) {
      console.log('用户未登录，跳过加载日程')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      console.log('正在加载用户日程，userId:', userId)
      const response = await fetch(`/api/calendar/events?userId=${userId}`)
      const data = await response.json()

      if (data.success) {
        // 转换日期字符串为Date对象
        const formattedEvents = data.data.events.map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }))
        console.log(`成功加载 ${formattedEvents.length} 条日程`)
        setEvents(formattedEvents)
      } else {
        console.error('加载事件失败:', data.error)
      }
    } catch (error) {
      console.error('加载事件失败:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // 处理事件选择
  const handleSelectEvent = (event: CalendarEventData) => {
    setSelectedEvent(event)
    setSelectedSlot(null)
    setDialogOpen(true)
  }

  // 处理时间槽选择
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    setSelectedEvent(null)
    setSelectedSlot({
      start: slotInfo.start,
      end: slotInfo.end,
    })
    setDialogOpen(true)
  }

  // 保存事件
  const handleSaveEvent = async (eventData: Partial<CalendarEventData>) => {
    try {
      const userId = getUserId()

      if (selectedEvent?._id) {
        // 更新现有事件
        const response = await fetch(`/api/calendar/events/${selectedEvent._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        })

        const data = await response.json()
        if (data.success) {
          await loadEvents()
        } else {
          throw new Error(data.error)
        }
      } else {
        // 创建新事件
        const response = await fetch('/api/calendar/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...eventData,
            userId,
          }),
        })

        const data = await response.json()
        if (data.success) {
          await loadEvents()
        } else {
          throw new Error(data.error)
        }
      }
    } catch (error) {
      console.error('保存事件失败:', error)
      throw error
    }
  }

  // 删除事件
  const handleDeleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/calendar/events/${eventId}`, {
        method: 'DELETE',
      })

      const data = await response.json()
      if (data.success) {
        await loadEvents()
      } else {
        throw new Error(data.error)
      }
    } catch (error) {
      console.error('删除事件失败:', error)
      throw error
    }
  }

  // 处理事件拖放
  const handleEventDrop = async (data: { event: CalendarEventData; start: Date; end: Date }) => {
    if (!data.event._id) return

    try {
      await handleSaveEvent({
        start: data.start,
        end: data.end,
      })
    } catch (error) {
      console.error('更新事件失败:', error)
      alert('更新失败，请重试')
    }
  }

  // 处理事件调整大小
  const handleEventResize = async (data: { event: CalendarEventData; start: Date; end: Date }) => {
    if (!data.event._id) return

    try {
      await handleSaveEvent({
        start: data.start,
        end: data.end,
      })
    } catch (error) {
      console.error('更新事件失败:', error)
      alert('更新失败，请重试')
    }
  }

  // 认证加载中
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-500">正在加载...</p>
        </div>
      </div>
    )
  }

  // 未登录提示
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center space-y-6 p-6">
          <div className="space-y-2">
            <div className="text-6xl">📅</div>
            <h2 className="text-xl font-semibold text-gray-900">需要登录</h2>
            <p className="text-gray-600">
              请先登录以查看和管理您的日程
            </p>
          </div>
          <div className="space-y-3">
            <Link href="/auth?mode=login&redirect=/calendar" className="block">
              <Button className="w-full">立即登录</Button>
            </Link>
            <Link href="/dashboard" className="block">
              <Button variant="outline" className="w-full">返回工作台</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回工作台
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                我的日历
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {user.username ? `${user.username}的日程` : '管理你的日程和任务'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadEvents}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
            <Button
              onClick={() => {
                setSelectedEvent(null)
                setSelectedSlot({
                  start: new Date(),
                  end: new Date(Date.now() + 60 * 60 * 1000),
                })
                setDialogOpen(true)
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              新建事件
            </Button>
          </div>
        </div>

        {/* 日历主体 */}
        <div className="h-[calc(100vh-200px)] min-h-[600px]">
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
                <p className="text-gray-600 dark:text-gray-400">加载中...</p>
              </div>
            </div>
          ) : (
            <BigCalendar
              events={events}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
            />
          )}
        </div>

        {/* 事件对话框 */}
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          event={selectedEvent}
          defaultStart={selectedSlot?.start}
          defaultEnd={selectedSlot?.end}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
      </div>
    </div>
  )
}
