'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { CalendarEventData } from '@/components/calendar/BigCalendar'
import { Button } from '@/components/ui/button'
import { Plus, ArrowLeft, RefreshCw, MessageCircle, Calendar as CalendarIcon, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { SlotInfo, View } from 'react-big-calendar'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

const BigCalendar = dynamic(
  () => import('@/components/calendar/BigCalendar').then((mod) => mod.BigCalendar),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm text-white/60">Loading Calendar...</p>
        </div>
      </div>
    ),
  }
)

const EventDialog = dynamic(
  () => import('@/components/calendar/EventDialog').then((mod) => mod.EventDialog),
  { ssr: false }
)

const DaySchedulePanel = dynamic(
  () => import('@/components/calendar/DaySchedulePanel').then((mod) => mod.DaySchedulePanel),
  { ssr: false }
)

export default function CalendarPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const [events, setEvents] = useState<CalendarEventData[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventData | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null)
  const [view, setView] = useState<View>('month')
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  // 加载事件
  const loadEvents = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const response = await fetch(API_ENDPOINTS.CALENDAR.EVENTS)
      const data = await response.json()

      if (data.success) {
        // 转换日期字符串为Date对象
        const formattedEvents = data.data.events.map((event: any) => ({
          ...event,
          start: new Date(event.start),
          end: new Date(event.end),
        }))
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
    // Check if it's month view and single day click
    if (view === 'month') {
      const daysDiff = Math.abs(slotInfo.end.getTime() - slotInfo.start.getTime()) / (1000 * 60 * 60 * 24)

      if (daysDiff <= 1) {
        setSelectedDay(slotInfo.start)
        return
      }
    }

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
      if (selectedEvent?._id) {
        // 更新现有事件
        const response = await fetch(API_ENDPOINTS.CALENDAR.EVENT(selectedEvent._id), {
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
        const response = await fetch(API_ENDPOINTS.CALENDAR.EVENTS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...eventData,
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
      const response = await fetch(API_ENDPOINTS.CALENDAR.EVENT(eventId), {
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
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
        <div className="relative z-10 flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-white/50" />
          <p className="text-white/60 text-sm font-light tracking-widest uppercase">Syncing Calendar</p>
        </div>
      </div>
    )
  }

  // 未登录提示
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
        <div className="relative z-10 w-full max-w-md mx-auto text-center space-y-6 p-8 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl">
          <div className="space-y-4">
            <div className="h-20 w-20 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center ring-1 ring-blue-500/40">
              <CalendarIcon className="h-10 w-10 text-blue-300" />
            </div>
            <h2 className="text-xl font-bold text-white">Login Required</h2>
            <p className="text-white/70">
              Please login to view and manage your schedule.
            </p>
          </div>
          <div className="space-y-3">
            <Link href="/auth?mode=login&redirect=/calendar" className="block">
              <Button className="w-full h-11 bg-white text-gray-900 border-0 hover:bg-white/90 font-medium rounded-xl">Login Now</Button>
            </Link>
            <Link href="/dashboard" className="block">
              <Button variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden font-sans bg-background">

      <div className="relative z-10 container mx-auto p-4 md:p-6 max-w-7xl h-screen flex flex-col">
        {/* 页面头部 */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between mb-4 flex-shrink-0 bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center justify-between sm:justify-start gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                My Calendar
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadEvents}
              disabled={loading}
              className="bg-white/5 border-white/10 text-white hover:bg-white/10 flex-1 sm:flex-initial justify-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-500 text-white border-0 shadow-lg shadow-indigo-500/20 flex-1 sm:flex-initial justify-center"
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
              New Event
            </Button>

            <Link href="/chat" className="flex-1 sm:flex-initial">
              <Button variant="outline" title="Chat Assistant" className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 justify-center">
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </Button>
            </Link>
          </div>
        </div>

        {/* 日历主体 */}
        <div className="flex-1 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl overflow-hidden p-1">
          {loading && events.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-500" />
                <p className="text-gray-500 font-medium">Loading Schedule...</p>
              </div>
            </div>
          ) : (
            <BigCalendar
              events={events}
              view={view}
              onViewChange={setView}
              onSelectEvent={handleSelectEvent}
              onSelectSlot={handleSelectSlot}
              onEventDrop={handleEventDrop}
              onEventResize={handleEventResize}
            />
          )}
        </div>

        {/* Dialogs */}
        <EventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          event={selectedEvent}
          defaultStart={selectedSlot?.start}
          defaultEnd={selectedSlot?.end}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />

        <DaySchedulePanel
          date={selectedDay}
          events={events}
          onClose={() => setSelectedDay(null)}
          onAddEvent={(start) => {
            setSelectedEvent(null)
            setSelectedSlot({
              start: start,
              end: new Date(start.getTime() + 60 * 60 * 1000)
            })
            setDialogOpen(true)
          }}
          onEditEvent={handleSelectEvent}
        />
      </div>
    </div>
  )
}
