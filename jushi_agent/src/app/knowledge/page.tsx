'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, Upload, Trash2, RefreshCw, FileText, ArrowLeft, Database } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'

interface DocumentFile {
    name: string
    size: number
    modified: number
}

export default function KnowledgeBasePage() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth()
    const [files, setFiles] = useState<DocumentFile[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [rebuilding, setRebuilding] = useState(false)
    const { toast } = useToast()

    // 加载文件列表
    const loadFiles = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/knowledge/files')
            const data = await res.json()
            if (data.success) {
                setFiles(data.files)
            } else {
                throw new Error(data.error)
            }
        } catch (error) {
            console.error('Failed to load files:', error)
            toast({
                title: '加载失败',
                description: '无法获取文件列表',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isAuthenticated) {
            loadFiles()
        }
    }, [isAuthenticated])

    // 处理文件上传
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setUploading(true)
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/knowledge/upload', {
                method: 'POST',
                body: formData,
            })

            const data = await res.json()
            if (data.success) {
                toast({
                    title: '上传成功',
                    description: `文件 ${file.name} 已添加`,
                })
                loadFiles()
            } else {
                throw new Error(data.error)
            }
        } catch (error) {
            console.error('Upload failed:', error)
            toast({
                title: '上传失败',
                description: error instanceof Error ? error.message : '未知错误',
                variant: 'destructive',
            })
        } finally {
            setUploading(false)
            // Clear input
            e.target.value = ''
        }
    }

    // 删除文件
    const handleDelete = async (filename: string) => {
        if (!confirm(`确定要删除 ${filename} 吗？`)) return

        try {
            const res = await fetch(`/api/knowledge/files/${filename}`, {
                method: 'DELETE',
            })
            const data = await res.json()
            if (data.success) {
                toast({
                    title: '删除成功',
                    description: `文件 ${filename} 已删除`,
                })
                loadFiles()
            } else {
                throw new Error(data.error)
            }
        } catch (error) {
            console.error('Delete failed:', error)
            toast({
                title: '删除失败',
                description: '无法删除文件',
                variant: 'destructive',
            })
        }
    }

    // 重建索引
    const handleRebuild = async () => {
        try {
            setRebuilding(true)
            const res = await fetch('/api/knowledge/rebuild', {
                method: 'POST',
            })
            const data = await res.json()
            if (data.success) {
                toast({
                    title: '重建成功',
                    description: data.message,
                })
            } else {
                throw new Error(data.error)
            }
        } catch (error) {
            console.error('Rebuild failed:', error)
            toast({
                title: '重建失败',
                description: '无法重建索引',
                variant: 'destructive',
            })
        } finally {
            setRebuilding(false)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString()
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        )
    }

    if (!isAuthenticated && !authLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-4 space-y-4">
                <h1 className="text-2xl font-bold">需要登录</h1>
                <p className="text-gray-500">请先登录以管理知识库</p>
                <Link href="/auth?mode=login&redirect=/knowledge">
                    <Button>前往登录</Button>
                </Link>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-8">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                <Database className="h-8 w-8 text-blue-600" />
                                知识库管理
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                上传和管理 RAG 文档，构建您的专属知识库
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRebuild}
                            disabled={rebuilding}
                            className="gap-2"
                        >
                            <RefreshCw className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
                            {rebuilding ? '重建中...' : '重建索引'}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    {/* 上传区域 */}
                    <Card className="md:col-span-1">
                        <CardHeader>
                            <CardTitle>上传文档</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer relative">
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    accept=".pdf,.txt,.md,.json,.csv,.docx"
                                />
                                <div className="flex flex-col items-center gap-3">
                                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                        {uploading ? (
                                            <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                                        ) : (
                                            <Upload className="h-6 w-6 text-blue-600" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-sm">
                                            {uploading ? '上传中...' : '点击或拖拽文件上传'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            支持 PDF, TXT, MD, DOCX
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 文件列表 */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle>已上传文档 ({files.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                                </div>
                            ) : files.length === 0 ? (
                                <div className="text-center py-12 text-gray-500">
                                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p>暂无文档，请上传文件开始构建知识库</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {files.map((file) => (
                                        <div
                                            key={file.name}
                                            className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border rounded-lg hover:shadow-sm transition-shadow"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="h-10 w-10 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                                    <FileText className="h-5 w-5 text-gray-500" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-sm truncate" title={file.name}>
                                                        {file.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {formatSize(file.size)} · {formatDate(file.modified)}
                                                    </p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                onClick={() => handleDelete(file.name)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
