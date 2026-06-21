'use client'

import React, { useState, useEffect, useRef } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { Save, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRouter } from 'next/navigation'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

interface DocumentEditorProps {
    eventId: string
    initialContent?: string
    eventName?: string
}

export default function DocumentEditor({
    eventId,
    initialContent = '',
    eventName = '工作文档'
}: DocumentEditorProps) {
    const [content, setContent] = useState(initialContent)
    const [saving, setSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [error, setError] = useState<string | null>(null)
    const { theme } = useTheme()
    const router = useRouter()
    const saveTimeoutRef = useRef<NodeJS.Timeout>()
    const hasUnsavedChanges = useRef(false)

    // 自动保存逻辑
    useEffect(() => {
        if (content === initialContent && !lastSaved) return

        hasUnsavedChanges.current = true

        // 清除上一次的定时器
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }

        // 设置新的定时器 (2秒后自动保存)
        saveTimeoutRef.current = setTimeout(() => {
            saveDocument()
        }, 2000)

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current)
            }
        }
    }, [content])

    const saveDocument = async () => {
        if (!hasUnsavedChanges.current) return

        setSaving(true)
        setError(null)

        try {
            const response = await fetch(API_ENDPOINTS.DOCUMENTS.BASE, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    eventId,
                    content
                })
            })

            const result = await response.json()

            if (!result.success) {
                throw new Error(result.error || '保存失败')
            }

            setLastSaved(new Date())
            hasUnsavedChanges.current = false
        } catch (err) {
            console.error('保存文档出错:', err)
            setError('保存失败，请检查网络连接')
        } finally {
            setSaving(false)
        }
    }

    const handleManualSave = () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current)
        }
        saveDocument()
    }

    return (
        <div className="flex h-full flex-col text-white">
            <div className="flex items-center justify-between border-b border-white/10 bg-black/10 px-6 py-4 backdrop-blur-xl">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => router.back()}
                        className="rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold text-white">
                            {eventName}
                        </h1>
                        <p className="flex items-center gap-2 text-xs text-white/[0.55]">
                            {saving ? (
                                <span className="flex items-center text-sky-200">
                                    <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-sky-200" />
                                    正在保存...
                                </span>
                            ) : error ? (
                                <span className="flex items-center text-red-200">
                                    <AlertCircle className="mr-1 h-3 w-3" />
                                    {error}
                                </span>
                            ) : lastSaved ? (
                                <span className="flex items-center text-emerald-200">
                                    <CheckCircle className="mr-1 h-3 w-3" />
                                    已保存 {lastSaved.toLocaleTimeString()}
                                </span>
                            ) : (
                                '准备就绪'
                            )}
                        </p>
                    </div>
                </div>

                <Button
                    onClick={handleManualSave}
                    disabled={saving}
                    variant={hasUnsavedChanges.current ? 'default' : 'outline'}
                    className={hasUnsavedChanges.current ? 'rounded-2xl bg-white text-gray-900 hover:bg-white/90' : 'rounded-2xl border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white'}
                >
                    <Save className="mr-2 h-4 w-4" />
                    保存
                </Button>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-6" data-color-mode={theme === 'dark' ? 'dark' : 'light'}>
                <div className="mx-auto h-full max-w-5xl overflow-hidden rounded-[28px] border border-white/[0.15] bg-white/10 shadow-2xl shadow-black/10 backdrop-blur-xl">
                    <MDEditor
                        value={content}
                        onChange={(val) => setContent(val || '')}
                        height="100%"
                        visibleDragbar={false}
                        preview="live"
                        enableScroll={false}
                        textareaProps={{
                            placeholder: '在这里记录您的工作内容、想法和待办事项...'
                        }}
                    />
                </div>
            </div>

            {error && (
                <div className="p-4 fixed bottom-0 left-0 right-0 z-50 flex justify-center">
                    <Alert variant="destructive" className="max-w-md shadow-lg animate-in slide-in-from-bottom-5">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {error} - <button onClick={handleManualSave} className="underline font-medium hover:text-red-100">重试</button>
                        </AlertDescription>
                    </Alert>
                </div>
            )}
        </div>
    )
}
