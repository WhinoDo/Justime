import { CalendarEventData } from './BigCalendar'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'

// --- Custom Event Component ---
export function CustomEvent({ event }: { event: CalendarEventData }) {
    const isAllDay = event.allDay
    const { isDesktop } = useDesktopRuntime()

    return (
        <div className={cn(
            "h-full w-full overflow-hidden px-2 py-1 transition-all duration-200 group",
            "border-l-2 hover:brightness-110",
            // Remove default background to apply our own glass style
            isDesktop
                ? "bg-violet-50/70 hover:bg-violet-100/80 text-[#171421] border-violet-300"
                : "bg-black/20 backdrop-blur-sm hover:bg-black/30 text-white"
        )}
            style={{
                borderColor: event.color || (isDesktop ? '#7c3aed' : '#3b82f6'),
                borderRadius: '0 4px 4px 0'
            }}
        >
            <div className="flex flex-col h-full justify-start">
                <div className="flex items-center gap-1.5 min-w-0">
                    {!isAllDay && (
                        <span className={cn("text-[10px] font-mono whitespace-nowrap hidden lg:inline-block", isDesktop ? "text-[#6d6680]" : "text-white/70")}>
                            {format(new Date(event.start), 'HH:mm')}
                        </span>
                    )}
                    <span className={cn("text-xs font-semibold truncate leading-tight shadow-sm", isDesktop ? "text-[#171421]" : "text-white")}>
                        {event.title}
                    </span>
                </div>

                {/* Additional info for taller events */}
                <div className="mt-1 hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    {event.location && (
                        <div className={cn("flex items-center gap-1 text-[10px]", isDesktop ? "text-[#8b7aa8]" : "text-white/60")}>
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
    const { isDesktop } = useDesktopRuntime()

    return (
        <div className="p-1">
            <span className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-all",
                isToday
                    ? (isDesktop
                        ? "bg-violet-600 text-white shadow-sm ring-2 ring-violet-200"
                        : "bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-500/20")
                    : (isDesktop
                        ? "text-[#6d6680] hover:bg-violet-50 hover:text-[#171421]"
                        : "text-gray-300 hover:bg-white/10 hover:text-white")
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
    const { isDesktop } = useDesktopRuntime()

    return (
        <div className={cn(
            "flex flex-col md:flex-row items-center justify-between mb-6 pb-6 gap-4 border-b",
            isDesktop ? "border-violet-200/40" : "border-white/10"
        )}>

            {/* Navigation Group */}
            <div className={cn(
                "flex items-center gap-1 rounded-xl p-1 shadow-inner border",
                isDesktop ? "bg-violet-50/50 border-violet-200/30" : "bg-black/20 border-white/5"
            )}>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('PREV')}
                    className={cn(
                        "h-8 w-8 p-0 rounded-lg",
                        isDesktop ? "hover:bg-violet-100/50 text-[#6d6680] hover:text-[#171421]" : "hover:bg-white/10 text-white/70 hover:text-white"
                    )}
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('TODAY')}
                    className={cn(
                        "h-8 px-3 text-xs font-medium rounded-lg",
                        isDesktop ? "text-[#6d6680] hover:text-[#171421] hover:bg-violet-100/50" : "text-white/70 hover:text-white hover:bg-white/10"
                    )}
                >
                    Today
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onNavigate('NEXT')}
                    className={cn(
                        "h-8 w-8 p-0 rounded-lg",
                        isDesktop ? "hover:bg-violet-100/50 text-[#6d6680] hover:text-[#171421]" : "hover:bg-white/10 text-white/70 hover:text-white"
                    )}
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            {/* Date Label */}
            <h3 className={cn(
                "text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-3",
                isDesktop ? "text-[#171421]" : "text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 drop-shadow-sm"
            )}>
                <CalendarIcon className={cn("h-6 w-6", isDesktop ? "text-violet-500" : "text-blue-400")} />
                {label}
            </h3>

            {/* View Switcher */}
            <div className={cn(
                "flex items-center rounded-xl p-1 shadow-inner border",
                isDesktop ? "bg-violet-50/50 border-violet-200/30" : "bg-black/20 border-white/5"
            )}>
                {['month', 'week', 'day', 'agenda'].map((v) => (
                    <button
                        key={v}
                        onClick={() => onView(v)}
                        className={cn(
                            "px-4 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 capitalize",
                            view === v
                                ? (isDesktop
                                    ? "bg-white text-violet-700 shadow-sm border border-violet-200/30"
                                    : "bg-white/20 text-white shadow-md backdrop-blur-sm")
                                : (isDesktop
                                    ? "text-[#6d6680] hover:text-[#171421] hover:bg-violet-100/30"
                                    : "text-white/50 hover:text-white hover:bg-white/5")
                        )}
                    >
                        {v === 'agenda' ? 'List' : v}
                    </button>
                ))}
            </div>
        </div>
    )
}
