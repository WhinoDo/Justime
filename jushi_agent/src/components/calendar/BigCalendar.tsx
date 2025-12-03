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
}

export function BigCalendar({
  events,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  onNavigate,
  onViewChange,
}: BigCalendarProps) {
  const [view, setView] = useState<View>('month')
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
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-lg shadow-lg">
      {/* 日历头部 */}
      <div className="flex items-center justify-between p-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            我的日历
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
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
        
        .calendar-container .rbc-header {
          padding: 12px 4px;
          font-weight: 600;
          color: #374151;
          background-color: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
        }
        
        .dark .calendar-container .rbc-header {
          color: #e5e7eb;
          background-color: #1f2937;
          border-bottom-color: #374151;
        }
        
        .calendar-container .rbc-today {
          background-color: #eff6ff;
        }
        
        .dark .calendar-container .rbc-today {
          background-color: #1e3a8a;
        }
        
        .calendar-container .rbc-event {
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .calendar-container .rbc-event:hover {
          opacity: 1 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .calendar-container .rbc-selected {
          background-color: #2563eb !important;
        }
        
        .calendar-container .rbc-off-range-bg {
          background-color: #f9fafb;
        }
        
        .dark .calendar-container .rbc-off-range-bg {
          background-color: #111827;
        }
        
        .calendar-container .rbc-time-slot {
          border-top: 1px solid #e5e7eb;
        }
        
        .dark .calendar-container .rbc-time-slot {
          border-top-color: #374151;
        }
        
        .calendar-container .rbc-day-slot .rbc-time-slot {
          border-top: 1px solid #f3f4f6;
        }
        
        .dark .calendar-container .rbc-day-slot .rbc-time-slot {
          border-top-color: #1f2937;
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
