'use client'

import { useState, useCallback, useMemo } from 'react'
import { Calendar, dateFnsLocalizer, View, SlotInfo, Components } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addHours } from 'date-fns'
import { zhCN } from 'date-fns/locale/zh-CN'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { CustomEvent, CustomToolbar, CustomDateHeader } from './CalendarComponents'

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
  resources?: Array<{
    title: string
    url: string
    type?: string
  }>
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
    showMore: (total: number) => `+${total} more`,
  }), [])

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

  // Custom Components Registration
  const components: Components<CalendarEventData, object> = useMemo(() => ({
    event: CustomEvent,
    toolbar: CustomToolbar,
    month: {
      header: CustomDateHeader
    }
  }), [])

  return (
    <div className="h-full flex flex-col calendar-theme-glass">

      {/* Calendar Body */}
      <div className="flex-1">
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
          //   eventPropGetter={eventStyleGetter} // We use CustomEvent component instead
          views={['month', 'week', 'day', 'agenda']}
          step={30}
          showMultiDayTimes
          defaultDate={new Date()}
          components={components}
        />
      </div>

      {/* macOS Style Calendar CSS Overrides */}
      <style jsx global>{`
        /* Core Reset */
        .calendar-theme-glass .rbc-calendar {
          font-family: inherit;
          color: hsl(var(--foreground));
        }

        /* Transparent Backgrounds */
        .calendar-theme-glass .rbc-month-view,
        .calendar-theme-glass .rbc-time-view,
        .calendar-theme-glass .rbc-agenda-view {
            background: transparent;
            border: none;
        }

        /* Headers */
        .calendar-theme-glass .rbc-header {
            padding: 10px 0;
            font-size: 0.8rem;
            font-weight: 500;
            color: hsl(var(--muted-foreground));
            border-bottom: 1px solid hsl(var(--border));
        }

        /* Grid Lines */
        .calendar-theme-glass .rbc-month-row,
        .calendar-theme-glass .rbc-day-bg,
        .calendar-theme-glass .rbc-time-content,
        .calendar-theme-glass .rbc-time-header-content {
             border-color: hsl(var(--border)) !important;
        }

        .calendar-theme-glass .rbc-day-bg + .rbc-day-bg {
             border-left: 1px solid hsl(var(--border));
        }

        .calendar-theme-glass .rbc-row-segment {
            padding: 1px 2px;
        }

        /* Today Highlight */
        .calendar-theme-glass .rbc-today {
            background: hsl(var(--accent));
        }

        .dark .calendar-theme-glass .rbc-today {
            background: rgba(255, 255, 255, 0.03);
        }

        /* Off-range dates - Dimmed */
        .calendar-theme-glass .rbc-off-range-bg {
            background: hsl(var(--muted) / 0.5);
        }

        /* Time Gutter */
        .calendar-theme-glass .rbc-timeslot-group {
            border-bottom: 1px solid hsl(var(--border)) !important;
        }
        .calendar-theme-glass .rbc-time-gutter .rbc-timeslot-group {
            border-color: hsl(var(--border));
        }
        .calendar-theme-glass .rbc-label {
            color: hsl(var(--muted-foreground));
            font-size: 0.75rem;
        }

        /* Current Time Indicator */
        .calendar-theme-glass .rbc-current-time-indicator {
            background-color: #7c3aed;
            height: 2px;
        }

        /* Events */
        .calendar-theme-glass .rbc-event {
            background: transparent !important;
            border: none !important;
            padding: 0 !important;
            box-shadow: none !important;
        }

        .calendar-theme-glass .rbc-event.rbc-selected {
            background: transparent !important;
        }

        /* Selected Slot */
        .calendar-theme-glass .rbc-slot-selection {
            background-color: rgba(124, 58, 237, 0.15);
            border: 1px solid rgba(124, 58, 237, 0.3);
            color: hsl(var(--foreground));
        }

        /* Popup Override */
        .rbc-overlay {
            background: hsl(var(--card)) !important;
            backdrop-filter: blur(16px);
            border: 1px solid hsl(var(--border));
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.12);
            padding: 8px;
            z-index: 100;
        }

        .rbc-overlay-header {
            border-bottom: 1px solid hsl(var(--border));
            color: hsl(var(--foreground));
            font-weight: 600;
            padding: 8px;
            margin-bottom: 8px;
        }

        .rbc-overlay-body {
            color: hsl(var(--foreground));
        }

        /* Week/Day View */
        .calendar-theme-glass .rbc-time-header.rbc-overflowing {
            border-right: 1px solid hsl(var(--border));
        }
        .calendar-theme-glass .rbc-header + .rbc-header {
            border-left: 1px solid hsl(var(--border));
        }

        /* Row border */
        .calendar-theme-glass .rbc-month-row + .rbc-month-row {
            border-top: 1px solid hsl(var(--border));
        }

        /* Agenda view */
        .calendar-theme-glass .rbc-agenda-view table tbody > tr > td {
            border-color: hsl(var(--border));
            color: hsl(var(--foreground));
        }
        .calendar-theme-glass .rbc-agenda-view table thead > tr > th {
            border-color: hsl(var(--border));
            color: hsl(var(--muted-foreground));
        }

      `}</style>
    </div>
  )
}

// Remove previously internal CustomToolbar if it exists in the same file to avoid conflicts
// or keep it if it was not exported, but since we are replacing the whole file, it's fine.
