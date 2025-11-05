'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, ChevronRight, Calendar, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CalendarEvent {
  event_id: string
  summary: string
  start_time: { timestamp: string }
  end_time: { timestamp: string }
  description?: string
  status?: string
}

interface MonthCalendarProps {
  events: CalendarEvent[]
  onDateSelect?: (date: Date) => void
  onEventClick?: (event: CalendarEvent) => void
  onCreateEvent?: (date: Date) => void
  selectedDate?: Date
}

export function MonthCalendar({ 
  events, 
  onDateSelect, 
  onEventClick, 
  onCreateEvent,
  selectedDate 
}: MonthCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null)

  // 获取当前月份的信息
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const today = new Date()
  
  // 获取月份的第一天和最后一天
  const firstDayOfMonth = new Date(year, month, 1)
  const lastDayOfMonth = new Date(year, month + 1, 0)
  const firstDayWeekday = firstDayOfMonth.getDay() // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate()

  // 获取上个月需要显示的天数
  const prevMonth = new Date(year, month - 1, 0)
  const daysFromPrevMonth = firstDayWeekday
  const daysFromNextMonth = 42 - (daysInMonth + daysFromPrevMonth) // 6 weeks * 7 days

  // 生成日历网格数据
  const calendarDays = []

  // 上个月的天数
  for (let i = daysFromPrevMonth; i > 0; i--) {
    const date = new Date(year, month - 1, prevMonth.getDate() - i + 1)
    calendarDays.push({
      date,
      isCurrentMonth: false,
      isPrevMonth: true,
      isNextMonth: false
    })
  }

  // 当前月的天数
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    calendarDays.push({
      date,
      isCurrentMonth: true,
      isPrevMonth: false,
      isNextMonth: false
    })
  }

  // 下个月的天数
  for (let day = 1; day <= daysFromNextMonth; day++) {
    const date = new Date(year, month + 1, day)
    calendarDays.push({
      date,
      isCurrentMonth: false,
      isPrevMonth: false,
      isNextMonth: true
    })
  }

  // 获取指定日期的事件
  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(parseInt(event.start_time.timestamp) * 1000)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  // 检查是否是今天
  const isToday = (date: Date) => {
    return date.toDateString() === today.toDateString()
  }

  // 检查是否是选中的日期
  const isSelected = (date: Date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString()
  }

  // 切换到上个月
  const goToPrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  // 切换到下个月
  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  // 切换到今天
  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // 处理日期点击
  const handleDateClick = (date: Date) => {
    onDateSelect?.(date)
  }

  // 处理创建事件
  const handleCreateEvent = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation()
    onCreateEvent?.(date)
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ]

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            {year}年 {monthNames[month]}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToToday}>
              今天
            </Button>
            <Button variant="outline" size="sm" onClick={goToPrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((dayInfo, index) => {
            const dayEvents = getEventsForDate(dayInfo.date)
            const isHovered = hoveredDate && dayInfo.date.toDateString() === hoveredDate.toDateString()

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[80px] p-1 border rounded-lg cursor-pointer transition-all hover:bg-gray-50",
                  {
                    "bg-blue-50 border-blue-200": isSelected(dayInfo.date),
                    "bg-yellow-50 border-yellow-200": isToday(dayInfo.date),
                    "text-gray-400": !dayInfo.isCurrentMonth,
                    "hover:bg-blue-100": isHovered && dayInfo.isCurrentMonth,
                  }
                )}
                onClick={() => handleDateClick(dayInfo.date)}
                onMouseEnter={() => setHoveredDate(dayInfo.date)}
                onMouseLeave={() => setHoveredDate(null)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={cn(
                    "text-sm font-medium",
                    {
                      "text-blue-600": isSelected(dayInfo.date),
                      "text-red-600": isToday(dayInfo.date),
                      "text-gray-900": dayInfo.isCurrentMonth && !isToday(dayInfo.date) && !isSelected(dayInfo.date),
                    }
                  )}>
                    {dayInfo.date.getDate()}
                  </span>
                  {dayInfo.isCurrentMonth && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-4 h-4 p-0 opacity-0 hover:opacity-100 transition-opacity"
                      onClick={(e) => handleCreateEvent(dayInfo.date, e)}
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                {/* 事件列表 */}
                <div className="space-y-1">
                  {dayEvents.slice(0, 2).map((event, eventIndex) => (
                    <div
                      key={event.event_id || eventIndex}
                      className="text-xs p-1 bg-blue-100 text-blue-800 rounded truncate cursor-pointer hover:bg-blue-200"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick?.(event)
                      }}
                      title={event.summary}
                    >
                      {event.summary}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{dayEvents.length - 2} 更多
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* 图例 */}
        <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-200 rounded"></div>
            <span>今天</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-200 rounded"></div>
            <span>已选择</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-100 rounded"></div>
            <span>有日程</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
