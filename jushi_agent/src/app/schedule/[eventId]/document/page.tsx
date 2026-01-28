'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

// 动态导入 DocumentEditor 以避免 SSR 问题 (MDEditor 依赖 window)
const DocumentEditor = dynamic(
    () => import('@/components/document/DocumentEditor'),
    { ssr: false }
)

interface EventData {
    _id: string
    title: string
    userId: string
    start: string
    end: string
}

export default function DocumentPage() {
    const { eventId } = useParams()
    const { user, isLoading: authLoading } = useAuth()
    const router = useRouter()

    const [event, setEvent] = useState<EventData | null>(null)
    const [content, setContent] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (authLoading) return

        if (!user) {
            router.push(`/login?redirect=/schedule/${eventId}/document`)
            return
        }

        const fetchData = async () => {
            try {
                setLoading(true)

                // 1. 获取事件详情
                const eventRes = await fetch(`/api/calendar/events?userId=${user.id}`)
                const eventData = await eventRes.json()

                if (!eventData.success) {
                    throw new Error('获取日程列表失败')
                }

                const targetEvent = eventData.data.events.find((e: any) => e._id === eventId)
                if (!targetEvent) {
                    throw new Error('找不到该日程事件')
                }
                setEvent(targetEvent)

                // 2. 获取文档内容
                const docRes = await fetch(`/api/documents?userId=${user.id}&eventId=${eventId}`)
                const docData = await docRes.json()

                if (docData.success && docData.data.document) {
                    setContent(docData.data.document.content)
                }
            } catch (err) {
                console.error('加载文档数据失败:', err)
                setError(err instanceof Error ? err.message : '加载失败')
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [user, authLoading, eventId, router])

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
                    <p className="text-gray-500">加载文档中...</p>
                </div>
            </div>
        )
    }

    if (error || !user) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        无法加载文档
                    </h2>
                    <p className="text-gray-500 mb-4">{error || '请先登录'}</p>
                    <button
                        onClick={() => router.back()}
                        className="text-purple-600 hover:underline"
                    >
                        返回上一页
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="h-screen flex flex-col">
            <DocumentEditor
                eventId={eventId as string}
                userId={user.id}
                initialContent={content}
                eventName={event?.title || '工作文档'}
            />
        </div>
    )
}
