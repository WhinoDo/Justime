'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useAuth } from '@/hooks/useAuth'
import { JushiGlassPanel } from '@/components/layout/JushiGlassPanel'
import { JushiPageShell } from '@/components/layout/JushiPageShell'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Loader2 } from 'lucide-react'

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
                const eventRes = await fetch('/api/calendar/events')
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
                const docRes = await fetch(`/api/documents?eventId=${eventId}`)
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
            <JushiPageShell fullHeight blur="xl" contentClassName="flex h-full items-center justify-center p-4" opacity={0.35}>
                <JushiGlassPanel className="rounded-3xl px-8 py-10 text-center text-white">
                    <div className="flex flex-col items-center gap-4">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                        <p className="text-white/65">加载文档中...</p>
                    </div>
                </JushiGlassPanel>
            </JushiPageShell>
        )
    }

    if (error || !user) {
        return (
            <JushiPageShell fullHeight blur="xl" contentClassName="flex h-full items-center justify-center p-4" opacity={0.35}>
                <JushiGlassPanel className="max-w-md rounded-3xl px-8 py-10 text-center text-white">
                    <h2 className="mb-2 text-xl font-semibold text-white">
                        无法加载文档
                    </h2>
                    <p className="mb-4 text-white/60">{error || '请先登录'}</p>
                    <Button
                        variant="ghost"
                        onClick={() => router.back()}
                        className="rounded-2xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        返回上一页
                    </Button>
                </JushiGlassPanel>
            </JushiPageShell>
        )
    }

    return (
        <JushiPageShell fullHeight blur="lg" opacity={0.35} contentClassName="h-full p-3 md:p-4">
            <JushiGlassPanel className="flex h-full flex-col overflow-hidden rounded-[32px] bg-white/8">
                <DocumentEditor
                    eventId={eventId as string}
                    initialContent={content}
                    eventName={event?.title || '工作文档'}
                />
            </JushiGlassPanel>
        </JushiPageShell>
    )
}
