'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
    Calendar,
    Clock,
    MapPin,
    CheckCircle,
    X,
    Loader2,
    AlertCircle,
    FileText
} from 'lucide-react'

// 事件类型映射
const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
    task: { label: '任务', color: 'bg-blue-100 text-blue-800' },
    meeting: { label: '会议', color: 'bg-purple-100 text-purple-800' },
    reminder: { label: '提醒', color: 'bg-yellow-100 text-yellow-800' },
    deadline: { label: '截止日期', color: 'bg-red-100 text-red-800' },
    other: { label: '其他', color: 'bg-gray-100 text-gray-800' }
}

// 优先级映射
const PRIORITY_LABELS: Record<string, { label: string; color: string }> = {
    low: { label: '低', color: 'text-gray-500' },
    medium: { label: '中', color: 'text-blue-500' },
    high: { label: '高', color: 'text-orange-500' },
    urgent: { label: '紧急', color: 'text-red-500' }
}

export interface SuggestedCalendarEvent {
    _id?: string
    title: string
    description?: string
    start: string
    end: string
    type?: string
    priority?: string
    location?: string
    allDay?: boolean
    aiGenerated?: boolean
    conflicts?: any[] // Conflicting events from DB
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

    const eventType = EVENT_TYPE_LABELS[event.type || 'other'] || EVENT_TYPE_LABELS.other
    const priority = PRIORITY_LABELS[event.priority || 'medium'] || PRIORITY_LABELS.medium

    // 格式化时间显示
    const formatDateTime = (isoString: string) => {
        try {
            const date = new Date(isoString)
            return date.toLocaleString('zh-CN', {
                month: 'long',
                day: 'numeric',
                weekday: 'short',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return isoString
        }
    }

    const formatTimeOnly = (isoString: string) => {
        try {
            const date = new Date(isoString)
            return date.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return isoString
        }
    }

    const handleConfirm = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const savedEvent = await onConfirm(event)
            if (savedEvent && savedEvent._id) {
                setSavedEventId(savedEvent._id)
            }
            setIsConfirmed(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : '添加失败')
        } finally {
            setIsLoading(false)
        }
    }

    if (isConfirmed) {
        return (
            <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">日程已添加到日历</span>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-500 mb-3">
                        「{event.title}」已成功添加
                    </p>
                    {savedEventId && (
                        <Link href={`/schedule/${savedEventId}/document`} className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                            <FileText className="h-4 w-4" />
                            编写工作文档
                        </Link>
                    )}
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                {/* 头部 */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                            AI 日程建议
                        </span>
                    </div>
                    <Badge className={eventType.color}>
                        {eventType.label}
                    </Badge>
                </div>

                {/* 标题 */}
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {event.title}
                </h4>

                {/* 描述 */}
                {event.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {event.description}
                    </p>
                )}

                {/* 时间信息 */}
                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-2">
                    <Clock className="h-4 w-4" />
                    <span>
                        {formatDateTime(event.start)} - {formatTimeOnly(event.end)}
                    </span>
                </div>

                {/* 地点 */}
                {event.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <MapPin className="h-4 w-4" />
                        <span>{event.location}</span>
                    </div>
                )}

                {/* 优先级 */}
                <div className="flex items-center gap-2 text-sm mb-4">
                    <span className="text-gray-500">优先级:</span>
                    <span className={priority.color}>{priority.label}</span>
                </div>

                {/* 冲突提示 */}
                {event.conflicts && event.conflicts.length > 0 && !isConfirmed && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
                            <AlertCircle className="h-4 w-4" />
                            <span>发现 {event.conflicts.length} 个时间冲突</span>
                        </div>
                        <div className="space-y-2 mb-3">
                            {event.conflicts.map((conflict: any) => (
                                <div key={conflict._id} className="text-sm bg-white dark:bg-gray-800 p-2 rounded border border-red-100 dark:border-red-900/50 flex justify-between items-center">
                                    <span className="truncate flex-1 font-medium text-gray-700 dark:text-gray-300">
                                        {conflict.title}
                                    </span>
                                    <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
                                        {formatTimeOnly(conflict.start)} - {formatTimeOnly(conflict.end)}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-400 mb-2">
                            您希望如何处理？
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-red-200 hover:bg-red-100 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-900/30"
                                onClick={async () => {
                                    if (!confirm('确定要删除原有日程并替换为新日程吗？此操作无法撤销。')) return;
                                    setIsLoading(true);
                                    try {
                                        // Delete conflicting events
                                        await Promise.all(event.conflicts!.map((c: any) =>
                                            fetch(`/api/calendar/events/${c._id}`, { method: 'DELETE' })
                                        ));
                                        // Add new event
                                        await handleConfirm();
                                    } catch (err) {
                                        setError('替换失败: ' + (err instanceof Error ? err.message : String(err)));
                                        setIsLoading(false);
                                    }
                                }}
                                disabled={isLoading}
                            >
                                替换原日程
                            </Button>
                            <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleConfirm}
                                disabled={isLoading}
                            >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                强制添加
                            </Button>
                        </div>
                    </div>
                )}

                {/* 错误信息 */}
                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-3">
                        <AlertCircle className="h-4 w-4" />
                        <span>{error}</span>
                    </div>
                )}

                {/* 操作按钮 (无冲突时显示) */}
                {(!event.conflicts || event.conflicts.length === 0) && (
                    <div className="flex gap-2">
                        <Button
                            onClick={handleConfirm}
                            disabled={isLoading}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    添加中...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    确认添加
                                </>
                            )}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={onDismiss}
                            disabled={isLoading}
                            className="px-4"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
