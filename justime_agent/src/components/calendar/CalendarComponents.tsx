'use client'

import { CalendarEventData } from './BigCalendar'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale/zh-CN'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

// --- Custom Event Component ---
export function CustomEvent({ event }: { event: CalendarEventData }) {
    const isAllDay = event.allDay

    return (
        <div className={cn(
            "h-full w-full overflow-hidden px-2 py-1 transition-all duration-200 group",
            "border-l-2 hover:brightness-110",
            "bg-purple-50 dark:bg-purple-900/20",
            "text-foreground"
        )}
            style={{
                borderColor: event.color || '#7c3aed',
                borderRadius: '0 4px 4px 0'
            }}
        >
            <div className="flex flex-col h-full justify-start">
                <div className="flex items-center gap-1.5 min-w-0">
                    {!isAllDay && (
                        <span className="text-[10px] font-mono opacity-70 whitespace-nowrap hidden lg:inline-block">
                            {format(new Date(event.start), 'HH:mm')}
                        </span>
                    )}
                    <span className="text-xs font-semibold truncate leading-tight">
                        {event.title}
                    </span>
                </div>

                {/* Additional info for taller events */}
                <div className="mt-1 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {event.location && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <MapPin className="h-2.5 w-2.5" />
                            <span className="truncate">{event.location}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// --- Custom Month/Date Header ---
export function CustomDateHeader({ label, date }: { label: string, date: Date }) {
    const isToday = new Date().toDateString() === date.toDateString()

    return (
        <div className="p-1">
            <span className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-all",
                isToday
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-foreground"
            )}>
                {label}
            </span>
        </div>
    )
}

// --- Custom Toolbar ---
interface CustomToolbarProps {
    label: string
    onNavigate: (action: 'PREV' | 'NEXT' | 'TODAY') => void
    onView: (view: any) => void
    view: string
}

export function CustomToolbar({ label, onNavigate, onView, view }: CustomToolbarProps) {
    return (
        <div className="flex flex-col md:flex-row items-center justify-between px-4 py-3 gap-3">

            {/* Navigation Group */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('PREV')}
                    className="h-7 w-7 p-0 hover:bg-white dark:hover:bg-gray-700 text-muted-foreground hover:text-foreground rounded"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('TODAY')}
                    className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white dark:hover:bg-gray-700 rounded"
                >
                    Today
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('NEXT')}
                    className="h-7 w-7 p-0 hover:bg-white dark:hover:bg-gray-700 text-muted-foreground hover:text-foreground rounded"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Date Label */}
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-purple-500" />
                {label}
            </h3>

            {/* View Switcher (Segmented Control Style) */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                {['month', 'week', 'day', 'agenda'].map((v) => (
                    <button
                        key={v}
                        onClick={() => onView(v)}
                        className={cn(
                            "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 capitalize",
                            view === v
                                ? "bg-white dark:bg-gray-700 text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {v === 'agenda' ? 'List' : v}
                    </button>
                ))}
            </div>
        </div>
    )
}
