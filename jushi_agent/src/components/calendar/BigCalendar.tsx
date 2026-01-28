'use client'

import { useState, useCallback, useMemo } from 'react'
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addHours } from 'date-fns'
import { zhCN } from 'date-fns/locale/zh-CN'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Button } from '@/components/ui/button'
import { Plus, Calendar as CalendarIcon } from 'lucide-react'

// 配置中文本地化
const locales = {
  'zh-CN': zhCN,
}

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

// 事件类型定义
export interface CalendarEventData {
  _id?: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  description?: string
  type?: string
  priority?: string
  status?: string
  color?: string
  location?: string
}

interface BigCalendarProps {
  events: CalendarEventData[]
  onSelectEvent?: (event: CalendarEventData) => void
  onSelectSlot?: (slotInfo: SlotInfo) => void
  onEventDrop?: (data: { event: CalendarEventData; start: Date; end: Date }) => void
  onEventResize?: (data: { event: CalendarEventData; start: Date; end: Date }) => void
  onNavigate?: (date: Date) => void
  onViewChange?: (view: View) => void
  view?: View
}

export function BigCalendar({
  events,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  onNavigate,
  onViewChange,
  view: controlledView,
}: BigCalendarProps) {
  const [viewState, setViewState] = useState<View>('month')

  const view = controlledView || viewState
  const setView = (v: View) => {
    setViewState(v)
    onViewChange?.(v)
  }
  const [date, setDate] = useState(new Date())

  // 中文消息配置
  const messages = useMemo(() => ({
    today: '今天',
    previous: '上一页',
    next: '下一页',
    month: '月',
    week: '周',
    day: '日',
    agenda: '议程',
    date: '日期',
    time: '时间',
    event: '事件',
    allDay: '全天',
    work_week: '工作日',
    yesterday: '昨天',
    tomorrow: '明天',
    noEventsInRange: '该时间范围内没有事件',
    showMore: (total: number) => `+${total} 更多`,
  }), [])

  // 事件样式
  const eventStyleGetter = useCallback((event: CalendarEventData) => {
    const backgroundColor = event.color || '#3b82f6'
    const style = {
      backgroundColor,
      borderRadius: '6px',
      opacity: 0.9,
      color: 'white',
      border: '0px',
      display: 'block',
      fontSize: '13px',
      padding: '4px 8px',
    }
    return { style }
  }, [])

  // 处理视图变化
  const handleViewChange = useCallback((newView: View) => {
    setView(newView)
    onViewChange?.(newView)
  }, [onViewChange])

  // 处理日期导航
  const handleNavigate = useCallback((newDate: Date) => {
    setDate(newDate)
    onNavigate?.(newDate)
  }, [onNavigate])

  // 处理事件选择
  const handleSelectEvent = useCallback((event: CalendarEventData) => {
    onSelectEvent?.(event)
  }, [onSelectEvent])

  // 处理时间槽选择
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    onSelectSlot?.(slotInfo)
  }, [onSelectSlot])

  // 处理事件拖放
  const handleEventDrop = useCallback((data: any) => {
    onEventDrop?.({
      event: data.event,
      start: data.start,
      end: data.end,
    })
  }, [onEventDrop])

  // 处理事件调整大小
  const handleEventResize = useCallback((data: any) => {
    onEventResize?.({
      event: data.event,
      start: data.start,
      end: data.end,
    })
  }, [onEventResize])

  return (
    <div className="h-full flex flex-col rounded-2xl border border-white/20 shadow-xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-md transition-all duration-300 hover:shadow-2xl">
      {/* 日历头部 */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 dark:border-white/5 bg-white/30 dark:bg-black/20 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-gray-100 dark:to-gray-300 bg-clip-text text-transparent">
            我的日历
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 bg-white/50 dark:bg-black/30 px-3 py-1 rounded-full border border-white/20">
            {format(date, 'yyyy年MM月', { locale: zhCN })}
          </span>
        </div>
      </div>

      {/* 日历主体 */}
      <div className="flex-1 p-4 calendar-container">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          titleAccessor="title"
          allDayAccessor="allDay"
          style={{ height: '100%' }}
          culture="zh-CN"
          messages={messages}
          view={view}
          onView={handleViewChange}
          date={date}
          onNavigate={handleNavigate}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          selectable
          resizable
          popup
          eventPropGetter={eventStyleGetter}
          views={['month', 'week', 'day', 'agenda']}
          step={30}
          showMultiDayTimes
          defaultDate={new Date()}
          components={{
            toolbar: CustomToolbar,
          }}
        />
      </div>

      {/* 自定义样式 */}
      <style jsx global>{`
        .calendar-container .rbc-calendar {
          font-family: inherit;
        }
        
        /* Header */
        .calendar-container .rbc-header {
          padding: 12px 4px;
          font-weight: 600;
          color: #4b5563; /* gray-600 */
          background-color: rgba(255, 255, 255, 0.3);
          border-bottom: 2px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(4px);
        }
        
        .dark .calendar-container .rbc-header {
          color: #e5e7eb;
          background-color: rgba(0, 0, 0, 0.2);
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }
        
        /* Today cell */
        .calendar-container .rbc-today {
          background-color: rgba(59, 130, 246, 0.15); /* blue-500/15 */
        }
        
        .dark .calendar-container .rbc-today {
          background-color: rgba(59, 130, 246, 0.2);
        }
        
        /* Event styles */
        .calendar-container .rbc-event {
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(4px);
        }
        
        .calendar-container .rbc-event:hover {
          opacity: 1 !important;
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2);
          z-index: 50;
        }
        
        .calendar-container .rbc-selected {
          background-color: rgba(37, 99, 235, 0.9) !important; /* blue-600/90 */
        }
        
        /* Off-range cells */
        .calendar-container .rbc-off-range-bg {
          background-color: rgba(0, 0, 0, 0.05);
        }
        
        .dark .calendar-container .rbc-off-range-bg {
          background-color: rgba(0, 0, 0, 0.3);
        }
        
        /* Grid lines */
        .calendar-container .rbc-time-slot,
        .calendar-container .rbc-month-row,
        .calendar-container .rbc-day-bg {
          border-color: rgba(209, 213, 219, 0.4); /* gray-300/40 */
        }
        
        .dark .calendar-container .rbc-time-slot,
        .dark .calendar-container .rbc-month-row,
        .dark .calendar-container .rbc-day-bg {
          border-color: rgba(75, 85, 99, 0.4); /* gray-600/40 */
        }

        .calendar-container .rbc-time-content {
            border-top: 1px solid rgba(209, 213, 219, 0.4);
        }
        .dark .calendar-container .rbc-time-content {
            border-top: 1px solid rgba(75, 85, 99, 0.4);
        }
        
        /* Buttons in Toolbar */
        .calendar-container .rbc-toolbar button {
            color: inherit;
        }

        /* Popup Overlay */
        .rbc-overlay {
            z-index: 100 !important;
            background-color: rgba(255, 255, 255, 0.95);
            border-radius: 12px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            border: 1px solid rgba(0,0,0,0.1);
            backdrop-filter: blur(10px);
        }
        .dark .rbc-overlay {
            background-color: rgba(30, 41, 59, 0.95);
            border-color: rgba(255,255,255,0.1);
        }
        .rbc-overlay-header {
            padding: 8px 12px;
            font-weight: 600;
            border-bottom: 1px solid rgba(0,0,0,0.05);
        }
        .dark .rbc-overlay-header {
            border-bottom-color: rgba(255,255,255,0.05);
        }
      `}</style>
    </div>
  )
}

// 自定义工具栏
function CustomToolbar({ label, onNavigate, onView, view }: any) {
  return (
    <div className="flex items-center justify-between mb-4 pb-4 border-b dark:border-gray-700">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('PREV')}
          className="hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('TODAY')}
          className="hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        >
          今天
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('NEXT')}
          className="hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          下一页
        </Button>
      </div>

      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        {label}
      </h3>

      <div className="flex items-center gap-2">
        <Button
          variant={view === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView('month')}
        >
          月
        </Button>
        <Button
          variant={view === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView('week')}
        >
          周
        </Button>
        <Button
          variant={view === 'day' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView('day')}
        >
          日
        </Button>
        <Button
          variant={view === 'agenda' ? 'default' : 'outline'}
          size="sm"
          onClick={() => onView('agenda')}
        >
          议程
        </Button>
      </div>
    </div>
  )
}
