'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { SuggestedCalendarEvent } from '@/types'
import {
    Calendar,
    Clock,
    MapPin,
    CheckCircle,
    X,
    Loader2,
    Sparkles,
    ArrowRightLeft,
    AlertTriangle,
    FileText,
    Link as LinkIcon,
    ExternalLink
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

// 事件类型映射 - 视觉升级
const EVENT_TYPE_STYLES: Record<string, { label: string; className: string; icon?: any }> = {
    task: { label: '任务', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border-blue-500/20' },
    meeting: { label: '会议', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20' },
    reminder: { label: '提醒', className: 'bg-violet-500/10 text-violet-600 dark:text-violet-300 border-violet-500/20' },
    deadline: { label: '截止', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20' },
    other: { label: '事项', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20' }
}



interface SuggestedEventCardProps {
    event: SuggestedCalendarEvent
    onConfirm: (event: SuggestedCalendarEvent) => Promise<any>
    onDismiss: () => void
}

export function SuggestedEventCard({ event, onConfirm, onDismiss }: SuggestedEventCardProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isConfirmed, setIsConfirmed] = useState(false)
    const [savedEventId, setSavedEventId] = useState<string | null>(null)

    const typeStyle = EVENT_TYPE_STYLES[event.type || 'other'] || EVENT_TYPE_STYLES.other

    // 格式化逻辑保持不变...
    const formatDateTime = (isoString: string) => {
        try {
            const date = new Date(isoString)
            return date.toLocaleString('zh-CN', {
                month: 'short',
                day: 'numeric',
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch { return isoString }
    }

    const formatTimeOnly = (isoString: string) => {
        try {
            return new Date(isoString).toLocaleTimeString('zh-CN', {
                hour: '2-digit', minute: '2-digit'
            })
        } catch { return isoString }
    }

    const handleConfirm = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const savedEvent = await onConfirm(event)
            if (savedEvent && savedEvent._id) setSavedEventId(savedEvent._id)
            setIsConfirmed(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : '添加失败')
        } finally {
            setIsLoading(false)
        }
    }

    // Success State - Minimalist Glass
    if (isConfirmed) {
        return (
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-900/10 p-6 backdrop-blur-md transition-all duration-500 animate-in fade-in zoom-in-95">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                <div className="relative flex flex-col items-center justify-center text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">已加入日程</h4>
                        <p className="text-sm text-emerald-700/80 dark:text-emerald-300/80 mt-1">
                            {event.title}
                        </p>
                    </div>
                    {savedEventId && (
                        <Link
                            href={`/schedule/${savedEventId}/document`}
                            className="mt-2 text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-100/50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200/50 transition-colors"
                        >
                            <FileText className="h-3.5 w-3.5" />
                            <span>创建关联文档</span>
                        </Link>
                    )}
                </div>
            </div>
        )
    }

    const hasConflicts = event.conflicts && event.conflicts.length > 0

    return (
        <div className="group relative w-full overflow-hidden rounded-3xl border border-white/40 dark:border-white/10 bg-white/40 dark:bg-gray-900/40 shadow-xl backdrop-blur-xl transition-all duration-300 hover:shadow-2xl hover:bg-white/50 dark:hover:bg-gray-900/50">
            {/* Top Gradient Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 opacity-70" />

            <div className="p-5 space-y-5">
                {/* Header: AI & Badge */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-indigo-600 dark:text-indigo-300 px-2 py-1 rounded-full bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100/50 dark:border-indigo-800/30">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span className="tracking-wide uppercase">AI Insight</span>
                    </div>
                    <Badge variant="outline" className={cn("text-xs font-normal backdrop-blur-sm", typeStyle.className)}>
                        {typeStyle.label}
                    </Badge>
                </div>

                {/* Main Content */}
                <div className="space-y-1">
                    <h3 className="font-display text-lg font-semibold text-gray-900 dark:text-white leading-tight tracking-tight">
                        {event.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-mono">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formatDateTime(event.start)} - {formatTimeOnly(event.end)}</span>
                    </div>
                    {event.location && (
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 pt-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                        </div>
                    )}
                </div>

                {/* Description with Link Parsing */}
                {/* Description - Simplified as resources are separate */}
                {event.description && (
                    <div className="text-sm text-gray-600 dark:text-gray-300/90 leading-relaxed bg-white/30 dark:bg-black/10 p-3 rounded-xl border border-white/20 dark:border-white/5">
                        {event.description}
                    </div>
                )}

                {/* Resources Section - New Modular Display */}
                {event.resources && event.resources.length > 0 && (
                    <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <LinkIcon className="h-3 w-3" />
                            相关资源
                        </h4>
                        <div className="grid gap-2">
                            {event.resources.map((resource, i) => (
                                <a
                                    key={i}
                                    href={resource.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-2.5 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 hover:bg-blue-100/50 dark:hover:bg-blue-900/20 transition-colors group/resource"
                                >
                                    <div className="h-8 w-8 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover/resource:scale-105 transition-transform">
                                        <ExternalLink className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">
                                            {resource.title}
                                        </p>
                                        <p className="text-xs text-blue-500/80 dark:text-blue-400/60 truncate">
                                            {resource.url}
                                        </p>
                                    </div>
                                </a>
                            ))}
                        </div>
                    </div>
                )}

                {/* Timeline Divergence (Conflicts) */}
                {hasConflicts && (
                    <div className="relative overflow-hidden rounded-xl border border-violet-200/50 dark:border-violet-800/30 bg-violet-50/40 dark:bg-violet-900/10 p-4">
                        <div className="flex items-start gap-3">
                            <div className="p-1.5 rounded-full bg-violet-100/80 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 mt-0.5">
                                <ArrowRightLeft className="h-4 w-4" />
                            </div>
                            <div className="flex-1 space-y-2">
                                <p className="text-sm font-medium text-violet-900 dark:text-violet-200">
                                    时间冲突 (Timeline Divergence)
                                </p>
                                <div className="space-y-1.5 text-xs text-violet-800/80 dark:text-violet-300/80">
                                    {event.conflicts!.map((c: any) => (
                                        <div key={c._id} className="flex items-center justify-between pl-2 border-l-2 border-violet-300/50">
                                            <span className="truncate max-w-[120px]">{c.title}</span>
                                            <span className="font-mono text-[10px] opacity-80">
                                                {formatTimeOnly(c.start)}-{formatTimeOnly(c.end)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Conflict Actions */}
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs border-violet-200/50 hover:bg-violet-100/50 hover:text-violet-700 dark:border-violet-800/30 dark:hover:bg-violet-900/30 text-violet-600"
                                onClick={async () => {
                                    if (!confirm('确定要覆盖原有日程吗？')) return;
                                    setIsLoading(true);
                                    try {
                                        await Promise.all(event.conflicts!.map((c: any) =>
                                            fetch(API_ENDPOINTS.CALENDAR.EVENT(c._id), { method: 'DELETE' })
                                        ));
                                        await handleConfirm();
                                    } catch (err) {
                                        setError('替换失败');
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading}
                            >
                                替换原有
                            </Button>
                            <Button
                                size="sm"
                                className="h-8 text-xs bg-violet-500 hover:bg-violet-600 text-white border-0 shadow-lg shadow-violet-500/20"
                                onClick={handleConfirm}
                                disabled={isLoading}
                            >
                                强制并存
                            </Button>
                        </div>
                    </div>
                )}

                {/* Error Display */}
                {error && (
                    <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-900/20 p-2 rounded-lg">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Main Actions (No Conflict) */}
                {!hasConflicts && (
                    <div className="grid grid-cols-4 gap-3 pt-1">
                        <Button
                            variant="outline"
                            onClick={onDismiss}
                            disabled={isLoading}
                            className="col-span-1 h-10 border-gray-200/50 dark:border-gray-700/50 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 text-gray-500"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className="col-span-3 h-10 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 shadow-lg shadow-gray-200/50 dark:shadow-none border-0 transition-all active:scale-[0.98]"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="font-medium">确认添加</span>
                                </span>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    )
}
