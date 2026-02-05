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
            // Remove default background to apply our own glass style
            "bg-black/20 backdrop-blur-sm hover:bg-black/30",
            "text-white"
        )}
            style={{
                borderColor: event.color || '#3b82f6',
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
                    <span className="text-xs font-semibold truncate leading-tight shadow-sm">
                        {event.title}
                    </span>
                </div>

                {/* Additional info for taller events */}
                <div className="mt-1 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {event.location && (
                        <div className="flex items-center gap-1 text-[10px] text-white/60">
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
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-500/20"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
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
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 pb-6 border-b border-white/10 gap-4">

            {/* Navigation Group */}
            <div className="flex items-center gap-1 bg-black/20 rounded-xl p-1 border border-white/5 shadow-inner">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('PREV')}
                    className="h-8 w-8 p-0 hover:bg-white/10 text-white/70 hover:text-white rounded-lg"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('TODAY')}
                    className="h-8 px-3 text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
                >
                    Today
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('NEXT')}
                    className="h-8 w-8 p-0 hover:bg-white/10 text-white/70 hover:text-white rounded-lg"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Date Label with Glass Effect */}
            <h3 className="text-xl md:text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 tracking-tight drop-shadow-sm flex items-center gap-3">
                <CalendarIcon className="h-6 w-6 text-blue-400" />
                {label}
            </h3>

            {/* View Switcher (Segmented Control Style) */}
            <div className="flex items-center bg-black/20 rounded-xl p-1 border border-white/5 shadow-inner">
                {['month', 'week', 'day', 'agenda'].map((v) => (
                    <button
                        key={v}
                        onClick={() => onView(v)}
                        className={cn(
                            "px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 capitalize",
                            view === v
                                ? "bg-white/20 text-white shadow-md backdrop-blur-sm"
                                : "text-white/50 hover:text-white hover:bg-white/5"
                        )}
                    >
                        {/* Mapping internal view names to display names if needed, usually direct mapping works for basics */}
                        {v === 'agenda' ? 'List' : v}
                    </button>
                ))}
            </div>
        </div>
    )
}
