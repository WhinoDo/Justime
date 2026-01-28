'use client'

import { useMemo, useEffect, useRef } from 'react'
import { format, isSameDay, differenceInMinutes, startOfDay, addMinutes } from 'date-fns'
import { zhCN } from 'date-fns/locale/zh-CN'
import { X, Clock, Calendar as CalendarIcon, Plus, MapPin, AlignLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { CalendarEventData } from './BigCalendar'

interface DaySchedulePanelProps {
    date: Date | null
    events: CalendarEventData[]
    onClose: () => void
    onAddEvent: (start: Date) => void
    onEditEvent: (event: CalendarEventData) => void
}

export function DaySchedulePanel({
    date,
    events,
    onClose,
    onAddEvent,
    onEditEvent,
}: DaySchedulePanelProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    // 筛选当天的事件并排序
    const dayEvents = useMemo(() => {
        if (!date) return []
        return events
            .filter((event) => isSameDay(new Date(event.start), date))
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    }, [date, events])

    // 计算事件布局 ( 处理重叠 )
    const processedEvents = useMemo(() => {
        if (!dayEvents.length) return []

        // 1. Initialize layout data
        interface LayoutEvent extends CalendarEventData {
            startMs: number
            endMs: number
            colIndex: number
            totalCols: number
        }

        const events: LayoutEvent[] = dayEvents.map(e => ({
            ...e,
            startMs: new Date(e.start).getTime(),
            endMs: new Date(e.end).getTime(),
            colIndex: 0,
            totalCols: 1
        }))

        // 2. Resolve collisions (assign column indices)
        const columns: number[] = [] // stores end time of last event in each column

        events.forEach(event => {
            let placed = false
            for (let i = 0; i < columns.length; i++) {
                if (columns[i] <= event.startMs) {
                    event.colIndex = i
                    columns[i] = event.endMs
                    placed = true
                    break
                }
            }
            if (!placed) {
                event.colIndex = columns.length
                columns.push(event.endMs)
            }
        })

        // 3. Group overlapping events to determine shared width (Clusters)
        let cluster: LayoutEvent[] = []
        let clusterMaxEnd = 0

        const result: LayoutEvent[] = []

        for (const event of events) {
            if (cluster.length === 0) {
                cluster.push(event)
                clusterMaxEnd = event.endMs
            } else {
                // Check if overlaps with the *Cluster* timeframe
                // Strict overlap: start < clusterMaxEnd
                if (event.startMs < clusterMaxEnd) {
                    cluster.push(event)
                    clusterMaxEnd = Math.max(clusterMaxEnd, event.endMs)
                } else {
                    // Seal previous cluster
                    const maxCols = Math.max(...cluster.map(e => e.colIndex)) + 1
                    cluster.forEach(e => {
                        e.totalCols = maxCols
                        result.push(e)
                    })
                    // Start new cluster
                    cluster = [event]
                    clusterMaxEnd = event.endMs
                }
            }
        }
        // Seal last cluster
        if (cluster.length > 0) {
            const maxCols = Math.max(...cluster.map(e => e.colIndex)) + 1
            cluster.forEach(e => {
                e.totalCols = maxCols
                result.push(e)
            })
        }

        return result
    }, [dayEvents])

    // 自动滚动到最早的事件或当前时间
    useEffect(() => {
        if (date && scrollRef.current) {
            // Simple scroll to 8am or first event
            const firstEventHour = dayEvents.length > 0
                ? new Date(dayEvents[0].start).getHours()
                : 8

            const offset = Math.max(0, (firstEventHour - 1) * 60 * 2) // 2px per minute? No, 60px per hour logic below.
            // Logic below renders: top: hour * 60 => 1px = 1 min
            // So scroll offset should be hour * 60
            const scrollValues = (firstEventHour * 60) - 60 // 1 hour buffer

            setTimeout(() => {
                scrollRef.current?.scrollTo({ top: Math.max(0, scrollValues), behavior: 'smooth' })
            }, 100)
        }
    }, [date, dayEvents])

    if (!date) return null

    // 生成时间轴 (00:00 - 23:00)
    const hours = Array.from({ length: 24 }, (_, i) => i)

    const typeColors: any = {
        meeting: 'bg-purple-100/90 border-purple-200 text-purple-700 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300',
        task: 'bg-blue-100/90 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300',
        reminder: 'bg-yellow-100/90 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-800 dark:text-yellow-300',
        deadline: 'bg-red-100/90 border-red-200 text-red-700 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300',
        other: 'bg-gray-100/90 border-gray-200 text-gray-700 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-300',
    }

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[450px] bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ease-in-out border-l border-white/20 dark:border-white/5 flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100/50 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <span className="text-4xl text-blue-600 font-extrabold">{format(date, 'd')}</span>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-500 uppercase">{format(date, 'MMM', { locale: zhCN })}</span>
                                <span className="text-sm text-gray-400 font-normal">{format(date, 'EEEE', { locale: zhCN })}</span>
                            </div>
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="icon" variant="ghost" className="rounded-full hover:bg-gray-100" onClick={() => onAddEvent(new Date(date.setHours(9, 0, 0, 0)))}>
                            <Plus className="w-5 h-5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="rounded-full hover:bg-gray-100" onClick={onClose}>
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                {/* Timeline Content */}
                <div className="flex-1 overflow-y-auto relative bg-gray-50/50 dark:bg-gray-900/50" ref={scrollRef}>
                    <div className="min-h-[1440px] relative w-full">
                        {/* 时间网格 */}
                        {hours.map((hour) => (
                            <div key={hour} className="absolute w-full flex group" style={{ top: `${hour * 60}px`, height: '60px' }}>
                                <div className="w-16 flex-shrink-0 text-right pr-4 pt-2">
                                    <span className="text-xs font-medium text-gray-400 group-hover:text-blue-500 transition-colors">
                                        {format(new Date().setHours(hour, 0), 'HH:mm')}
                                    </span>
                                </div>
                                <div className="flex-1 border-t border-gray-100 dark:border-gray-800 relative group-hover:border-blue-50/50 transition-colors">
                                    {/* Add event button area for this hour */}
                                    <div
                                        className="absolute inset-0 hover:bg-blue-50/30 cursor-pointer transition-colors z-0"
                                        onClick={() => onAddEvent(new Date(date.setHours(hour, 0, 0, 0)))}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* 当前时间线 */}
                        {isSameDay(new Date(), date) && (() => {
                            const now = new Date()
                            const minutes = now.getHours() * 60 + now.getMinutes()
                            return (
                                <div
                                    className="absolute left-16 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                                    style={{ top: `${minutes}px` }}
                                >
                                    <div className="absolute -left-1.5 w-3 h-3 bg-red-500 rounded-full" />
                                </div>
                            )
                        })()}

                        {/* 事件卡片 */}
                        {processedEvents.map((event) => {
                            const start = new Date(event.start)
                            const end = new Date(event.end)
                            const startMinutes = start.getHours() * 60 + start.getMinutes()
                            const duration = differenceInMinutes(end, start) || 60

                            const colorClass = typeColors[event.type || 'other'] || typeColors.other

                            // Width calculation
                            // Use colIndex and totalCols.
                            // left: 4rem + (colIndex / totalCols) * (100% - 4rem - 1rem)
                            // width: (1 / totalCols) * (100% - 4rem - 1rem)

                            const leftPercent = (event.colIndex / event.totalCols) * 100
                            const widthPercent = (1 / event.totalCols) * 100

                            return (
                                <div
                                    key={event._id}
                                    className={cn(
                                        "absolute rounded-lg border shadow-sm p-3 hover:shadow-md transition-all cursor-pointer z-10 overflow-hidden group",
                                        colorClass
                                    )}
                                    style={{
                                        top: `${startMinutes}px`,
                                        height: `${Math.max(duration, 30)}px`,
                                        left: `calc(4rem + (100% - 5rem) * ${event.colIndex} / ${event.totalCols})`,
                                        width: `calc((100% - 5rem) / ${event.totalCols})`,
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onEditEvent(event)
                                    }}
                                >
                                    {/* Left accent bar */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-current opacity-40" />

                                    <div className="pl-2 h-full flex flex-col">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className="text-sm font-semibold truncate leading-tight">
                                                {event.title}
                                            </h4>
                                            <span className="text-xs font-mono opacity-70 whitespace-nowrap">
                                                {format(start, 'HH:mm')}
                                            </span>
                                        </div>

                                        {duration > 45 && (
                                            <>
                                                <div className="flex items-center gap-1 mt-1 opacity-80 text-xs">
                                                    <Clock className="w-3 h-3" />
                                                    <span>
                                                        {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                                                    </span>
                                                </div>
                                                {event.location && (
                                                    <div className="flex items-center gap-1 mt-0.5 opacity-80 text-xs truncate">
                                                        <MapPin className="w-3 h-3" />
                                                        <span>{event.location}</span>
                                                    </div>
                                                )}
                                                {/* Hidden description on small width? CSS handles truncate mostly */}
                                                {event.description && (
                                                    <div className="flex items-center gap-1 mt-1 opacity-70 text-xs line-clamp-1">
                                                        <AlignLeft className="w-3 h-3" />
                                                        <span>{event.description}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Footer info/stats */}
                <div className="p-4 border-t border-gray-100/50 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-900/50 backdrop-blur-sm text-xs text-gray-500 flex justify-between">
                    <span>{dayEvents.length} 个日程</span>
                    <span>空闲时间: {((1440 - dayEvents.reduce((acc, e) => acc + (differenceInMinutes(new Date(e.end), new Date(e.start)) || 0), 0)) / 60).toFixed(1)} 小时</span>
                </div>
            </div>
        </>
    )
}
