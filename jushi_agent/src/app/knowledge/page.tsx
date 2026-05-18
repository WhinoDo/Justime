'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, Upload, Trash2, RefreshCw, FileText, ArrowLeft, Database, Eye, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'
import { JushiBackground } from '@/components/ui/JushiBackground'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import dynamic from 'next/dynamic'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

const MarkdownPreview = dynamic(
    () => import('@/components/knowledge/MarkdownPreview').then((mod) => mod.MarkdownPreview),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
            </div>
        )
    }
)

interface DocumentFile {
    name: string
    size: number
    modified: number
}

interface PreviewState {
    open: boolean
    fileName: string
    isPdf: boolean
    rawUrl: string
    content: string
    loading: boolean
    error: string
    truncated: boolean
    charCount: number
    maxChars: number
}

export default function KnowledgeBasePage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth()
    const [files, setFiles] = useState<DocumentFile[]>([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [rebuilding, setRebuilding] = useState(false)
    const [rebuildTaskId, setRebuildTaskId] = useState<string | null>(null)
    const [rebuildStatus, setRebuildStatus] = useState<{ status: string; message?: string; error?: string } | null>(null)
    const [showRebuildStatus, setShowRebuildStatus] = useState(false)
    const [previewState, setPreviewState] = useState<PreviewState>({
        open: false,
        fileName: '',
        isPdf: false,
        rawUrl: '',
        content: '',
        loading: false,
        error: '',
        truncated: false,
        charCount: 0,
        maxChars: 20000,
    })
    const { toast } = useToast()

    // 加载文件列表
    const loadFiles = async () => {
        try {
            setLoading(true)
            const res = await fetch(API_ENDPOINTS.KNOWLEDGE.FILES)
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

            const res = await fetch(API_ENDPOINTS.KNOWLEDGE.UPLOAD, {
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
            const res = await fetch(API_ENDPOINTS.KNOWLEDGE.FILE(filename), {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' }
            })
            // Checking if response is ok before parsing json, or handle json parse error
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    toast({
                        title: '删除成功',
                        description: `文件 ${filename} 已删除`,
                    })
                    loadFiles()
                } else {
                    throw new Error(data.error || 'Delete failed')
                }
            } else {
                throw new Error(`Delete failed with status: ${res.status}`)
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

    const handleRebuild = async () => {
        try {
            setRebuilding(true)
            setRebuildStatus(null)
            const res = await fetch(API_ENDPOINTS.KNOWLEDGE.REBUILD, {
                method: 'POST',
            })
            const data = await res.json()
            if (data.success) {
                setRebuildTaskId(data.task_id)
                setRebuildStatus({ status: 'pending', message: '索引重建任务已创建' })
                setShowRebuildStatus(true)
                toast({
                    title: '重建已启动',
                    description: data.message || '索引重建任务已创建',
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

    useEffect(() => {
        if (!rebuildTaskId || !showRebuildStatus) return
        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(API_ENDPOINTS.KNOWLEDGE.REBUILD_STATUS(rebuildTaskId))
                const data = await res.json()
                if (data.success) {
                    setRebuildStatus({
                        status: data.status,
                        message: data.message,
                        error: data.error,
                    })
                    if (data.status === 'completed' || data.status === 'failed') {
                        clearInterval(pollInterval)
                        if (data.status === 'completed') {
                            toast({ title: '索引重建完成', description: data.message })
                        }
                    }
                }
            } catch {
                clearInterval(pollInterval)
            }
        }, 3000)
        return () => clearInterval(pollInterval)
    }, [rebuildTaskId, showRebuildStatus])

    const closePreview = () => {
        setPreviewState((prev) => ({
            ...prev,
            open: false,
        }))
    }

    const openPreview = async (filename: string) => {
        const pdfPreview = isPdfFile(filename)
        const rawUrl = pdfPreview ? API_ENDPOINTS.KNOWLEDGE.RAW(filename) : ''

        setPreviewState({
            open: true,
            fileName: filename,
            isPdf: pdfPreview,
            rawUrl,
            content: '',
            loading: !pdfPreview,
            error: '',
            truncated: false,
            charCount: 0,
            maxChars: 20000,
        })

        if (pdfPreview) {
            return
        }

        try {
            const response = await fetch(API_ENDPOINTS.KNOWLEDGE.CONTENT(filename), {
                credentials: 'include',
            })
            const payload = await response.json()

            if (!response.ok || !payload.success) {
                throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`)
            }

            setPreviewState((prev) => ({
                ...prev,
                content: String(payload.content || ''),
                truncated: Boolean(payload.truncated),
                charCount: Number(payload.charCount || 0),
                maxChars: Number(payload.maxChars || 20000),
                loading: false,
            }))
        } catch (error) {
            setPreviewState((prev) => ({
                ...prev,
                loading: false,
                error: error instanceof Error ? error.message : '文档预览加载失败',
            }))
        }
    }

    const isMarkdownFile = (filename: string) => {
        const lower = filename.toLowerCase()
        return lower.endsWith('.md') || lower.endsWith('.markdown')
    }

    const isPdfFile = (filename: string) => {
        return filename.toLowerCase().endsWith('.pdf')
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
            <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
                <JushiBackground blur="xl" />
                <div className="relative z-10 flex flex-col items-center gap-3">
                    <Database className="h-10 w-10 text-white/50 animate-pulse" />
                    <p className="text-white/60 text-sm font-light tracking-widest uppercase">Loading Knowledge Base</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated && !authLoading) {
        return (
            <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
                <JushiBackground blur="lg" opacity={0.6} />
                <div className="relative z-10 w-full max-w-md mx-auto text-center space-y-6 p-8 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-3xl shadow-2xl">
                    <div className="space-y-4">
                        <div className="h-20 w-20 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center ring-1 ring-indigo-500/40">
                            <Database className="h-10 w-10 text-indigo-300" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Login Required</h2>
                        <p className="text-white/70">Please login to manage your knowledge base.</p>
                    </div>
                    <div className="space-y-3">
                        <Link href="/auth?mode=login&redirect=/knowledge" className="block">
                            <Button className="w-full h-11 bg-white text-gray-900 border-0 hover:bg-white/90 font-medium rounded-xl">Login Now</Button>
                        </Link>
                        <Link href="/dashboard" className="block">
                            <Button variant="ghost" className="w-full text-white/50 hover:text-white hover:bg-white/5">Back to Dashboard</Button>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen relative overflow-hidden font-sans">
            <JushiBackground blur="lg" opacity={0.5} />

            <div className="relative z-10 container mx-auto p-4 md:p-8 max-w-5xl animate-in fade-in zoom-in-95 duration-700">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard">
                                <Button variant="ghost" size="icon" className="text-white/70 hover:bg-white/10 hover:text-white rounded-full">
                                    <ArrowLeft className="h-5 w-5" />
                                </Button>
                            </Link>
                            <div>
                                <h1 className="text-3xl font-bold text-white flex items-center gap-3 drop-shadow-md">
                                    <Database className="h-8 w-8 text-indigo-300" />
                                    Knowledge Base
                                </h1>
                                <p className="text-sm text-white/60 mt-1 font-light tracking-wide">
                                    Manage RAG documents and build your personal knowledge graph
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handleRebuild}
                                disabled={rebuilding}
                                className="gap-2 bg-white/5 border-white/10 text-white hover:bg-white/10 backdrop-blur-sm"
                            >
                                <RefreshCw className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
                                {rebuilding ? 'Rebuilding...' : 'Rebuild Index'}
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-3">
                        {/* Upload Area */}
                        <div className="md:col-span-1">
                            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl h-full flex flex-col">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    <Upload className="h-5 w-5 text-blue-300" />
                                    Upload
                                </h3>
                                <div className="flex-1 border-2 border-dashed border-white/20 rounded-2xl p-6 text-center hover:bg-white/5 transition-all cursor-pointer relative flex flex-col items-center justify-center group">
                                    <input
                                        type="file"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        accept=".pdf,.txt,.md,.markdown,.json,.csv,.yaml,.yml,.xml,.html,.htm,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.odt,.ods,.odp,.py,.js,.ts,.tsx,.jsx,.java,.c,.cpp,.go,.rs,.log,.ini"
                                    />
                                    <div className="h-14 w-14 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        {uploading ? (
                                            <Loader2 className="h-7 w-7 text-blue-300 animate-spin" />
                                        ) : (
                                            <Upload className="h-7 w-7 text-blue-300" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium text-sm text-white/90">
                                            {uploading ? 'Uploading...' : 'Click or Drag files'}
                                        </p>
                                        <p className="text-xs text-white/50">
                                            PDF, TXT, MD, DOCX, XLSX, CSV, JSON, YAML, PPTX...
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* File List */}
                        <div className="md:col-span-2">
                            <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl min-h-[400px]">
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-emerald-300" />
                                        Documents ({files.length})
                                    </div>
                                    {/* Search placeholder could go here */}
                                </h3>

                                {loading ? (
                                    <div className="flex justify-center py-20">
                                        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
                                    </div>
                                ) : files.length === 0 ? (
                                    <div className="text-center py-20 text-white/30 flex flex-col items-center">
                                        <div className="h-16 w-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                            <FileText className="h-8 w-8 opacity-50" />
                                        </div>
                                        <p>No documents found.</p>
                                        <p className="text-sm mt-1">Upload files to get started.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {files.map((file) => (
                                            <div
                                                key={file.name}
                                                className="group flex items-center justify-between p-3 bg-black/20 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-white/70">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-medium text-sm text-white/90 truncate mr-2" title={file.name}>
                                                            {file.name}
                                                        </p>
                                                        <p className="text-xs text-white/40 font-mono">
                                                            {formatSize(file.size)} · {formatDate(file.modified)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-white/30 hover:text-sky-300 hover:bg-sky-500/20 rounded-lg"
                                                        onClick={() => openPreview(file.name)}
                                                        title="预览文档"
                                                    >
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-white/30 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg"
                                                        onClick={() => handleDelete(file.name)}
                                                        title="删除文档"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Dialog open={previewState.open} onOpenChange={(open) => !open && closePreview()}>
                <DialogContent className="max-w-4xl max-h-[85vh] bg-slate-950/95 border-white/20 text-white backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-10">文档预览: {previewState.fileName}</DialogTitle>
                        <DialogDescription className="text-white/60">
                            {previewState.isPdf ? '原生 PDF 预览（保留图片与排版）' : '在线查看文档解析内容（来自知识库预览接口）'}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="h-[62vh] rounded-xl border border-white/10 bg-black/20">
                        {previewState.isPdf ? (
                            <iframe
                                key={previewState.rawUrl}
                                src={previewState.rawUrl}
                                className="h-full w-full rounded-xl border-0 bg-white"
                                title={`PDF Preview: ${previewState.fileName}`}
                            />
                        ) : (
                            <ScrollArea className="h-full w-full p-4">
                                {previewState.loading ? (
                                    <div className="h-full min-h-[240px] flex items-center justify-center text-white/70 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        正在加载文档内容...
                                    </div>
                                ) : previewState.error ? (
                                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-4 text-sm flex gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{previewState.error}</span>
                                    </div>
                                ) : isMarkdownFile(previewState.fileName) ? (
                                    <MarkdownPreview content={previewState.content || '暂无内容'} />
                                ) : (
                                    <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-white/90 font-mono">
                                        {previewState.content || '暂无内容'}
                                    </pre>
                                )}
                            </ScrollArea>
                        )}
                    </div>

                    {!previewState.isPdf && previewState.truncated && !previewState.loading && !previewState.error && (
                        <p className="text-xs text-amber-300/90">
                            文档较长，当前仅展示前 {previewState.maxChars.toLocaleString()} 字内容（原文 {previewState.charCount.toLocaleString()} 字）。
                        </p>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={showRebuildStatus} onOpenChange={setShowRebuildStatus}>
                <DialogContent className="max-w-md bg-slate-950/95 border-white/20 text-white backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>索引重建状态</DialogTitle>
                        <DialogDescription className="text-white/60">
                            查看索引重建任务的实时进度
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {rebuildStatus ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    {rebuildStatus.status === 'completed' ? (
                                        <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center">
                                            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    ) : rebuildStatus.status === 'failed' ? (
                                        <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                            <AlertTriangle className="h-5 w-5 text-red-400" />
                                        </div>
                                    ) : (
                                        <Loader2 className="h-8 w-8 animate-spin text-blue-300" />
                                    )}
                                    <div>
                                        <p className="font-medium text-white">
                                            {rebuildStatus.status === 'completed' ? '已完成' : rebuildStatus.status === 'failed' ? '失败' : rebuildStatus.status === 'running' ? '进行中' : '等待中'}
                                        </p>
                                        {rebuildStatus.message && (
                                            <p className="text-sm text-white/60">{rebuildStatus.message}</p>
                                        )}
                                    </div>
                                </div>
                                {rebuildStatus.error && (
                                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 p-3 text-sm">
                                        {rebuildStatus.error}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
