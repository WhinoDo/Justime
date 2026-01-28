'use client'

import React, { useState, useEffect, useRef } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { Button } from '@/components/ui/button'
import { useTheme } from 'next-themes'
import { Save, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useRouter } from 'next/navigation'

interface DocumentEditorProps {
    eventId: string
    userId: string
    initialContent?: string
    eventName?: string
}

export default function DocumentEditor({
    eventId,
    userId,
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
            const response = await fetch('/api/documents', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId,
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
        <div className="flex flex-col h-full bg-white dark:bg-gray-950">
            {/* 头部工具栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-800">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {eventName}
                        </h1>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                            {saving ? (
                                <span className="flex items-center text-blue-500">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-1.5" />
                                    正在保存...
                                </span>
                            ) : error ? (
                                <span className="text-red-500 flex items-center">
                                    <AlertCircle className="w-3 h-3 mr-1" />
                                    {error}
                                </span>
                            ) : lastSaved ? (
                                <span className="text-green-600 dark:text-green-400 flex items-center">
                                    <CheckCircle className="w-3 h-3 mr-1" />
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
                    variant={hasUnsavedChanges.current ? "default" : "outline"}
                >
                    <Save className="w-4 h-4 mr-2" />
                    保存
                </Button>
            </div>

            {/* 编辑器区域 */}
            <div className="flex-1 overflow-auto p-6" data-color-mode={theme === 'dark' ? 'dark' : 'light'}>
                <div className="max-w-4xl mx-auto h-full shadow-sm rounded-lg overflow-hidden border dark:border-gray-700">
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
