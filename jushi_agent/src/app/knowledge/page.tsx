'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, Upload, Trash2, RefreshCw, FileText, ArrowLeft, Eye, AlertTriangle, Search, FileJson, FileType, FileImage, FileArchive } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'
import { Input } from '@/components/ui/input'
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
                <Loader2 className="h-6 w-6 animate-spin text-purple-500/50" />
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

function getFileTypeIcon(filename: string, className = 'h-5 w-5') {
    const lower = filename.toLowerCase()
    if (lower.endsWith('.pdf')) return <FileText className={`${className} text-red-500`} />
    if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return <FileJson className={`${className} text-yellow-500`} />
    if (lower.endsWith('.md') || lower.endsWith('.markdown') || lower.endsWith('.txt')) return <FileText className={`${className} text-blue-500`} />
    if (lower.endsWith('.csv') || lower.endsWith('.xls') || lower.endsWith('.xlsx')) return <FileType className={`${className} text-green-500`} />
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif') || lower.endsWith('.svg')) return <FileImage className={`${className} text-pink-500`} />
    if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.tar') || lower.endsWith('.gz')) return <FileArchive className={`${className} text-orange-500`} />
    if (lower.endsWith('.py') || lower.endsWith('.js') || lower.endsWith('.ts') || lower.endsWith('.tsx') || lower.endsWith('.java') || lower.endsWith('.cpp') || lower.endsWith('.go') || lower.endsWith('.rs')) return <FileText className={`${className} text-indigo-500`} />
    return <FileText className={`${className} text-gray-400 dark:text-gray-500`} />
}

function getFileTypeLabel(filename: string): string {
    const ext = filename.split('.').pop()?.toUpperCase() || 'FILE'
    return ext.length <= 4 ? ext : 'FILE'
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
    const [searchQuery, setSearchQuery] = useState('')
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
            const res = await fetch(API_ENDPOINTS.KNOWLEDGE.REBUILD, { method: 'POST' })
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
                    setRebuildStatus({ status: data.status, message: data.message, error: data.error })
                    if (data.status === 'completed' || data.status === 'failed') {
                        clearInterval(pollInterval)
                        if (data.status === 'completed') {
                            toast({ title: '索引重建完成', description: data.message })
                        }
                    }
                }
            } catch { clearInterval(pollInterval) }
        }, 3000)
        return () => clearInterval(pollInterval)
    }, [rebuildTaskId, showRebuildStatus])

    const closePreview = () => setPreviewState((prev) => ({ ...prev, open: false }))

    const openPreview = async (filename: string) => {
        const pdfPreview = filename.toLowerCase().endsWith('.pdf')
        const rawUrl = pdfPreview ? API_ENDPOINTS.KNOWLEDGE.RAW(filename) : ''
        setPreviewState({ open: true, fileName: filename, isPdf: pdfPreview, rawUrl, content: '', loading: !pdfPreview, error: '', truncated: false, charCount: 0, maxChars: 20000 })
        if (pdfPreview) return
        try {
            const response = await fetch(API_ENDPOINTS.KNOWLEDGE.CONTENT(filename), { credentials: 'include' })
            const payload = await response.json()
            if (!response.ok || !payload.success) throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`)
            setPreviewState((prev) => ({ ...prev, content: String(payload.content || ''), truncated: Boolean(payload.truncated), charCount: Number(payload.charCount || 0), maxChars: Number(payload.maxChars || 20000), loading: false }))
        } catch (error) {
            setPreviewState((prev) => ({ ...prev, loading: false, error: error instanceof Error ? error.message : '文档预览加载失败' }))
        }
    }

    const isMarkdownFile = (filename: string) => {
        const lower = filename.toLowerCase()
        return lower.endsWith('.md') || lower.endsWith('.markdown')
    }

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const formatDate = (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString()
    }

    const filteredFiles = searchQuery
        ? files.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : files

    if (authLoading) {
        return (
            <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
                <div className="relative z-10 flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500/70" />
                    <p className="text-gray-400 dark:text-gray-500 text-sm font-light tracking-widest uppercase">Loading Knowledge Base</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated && !authLoading) {
        return (
            <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
                <div className="relative z-10 w-full max-w-md mx-auto text-center space-y-6 p-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg">
                    <div className="space-y-4">
                        <div className="h-20 w-20 mx-auto rounded-full bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center">
                            <FileText className="h-10 w-10 text-purple-500" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Login Required</h2>
                        <p className="text-gray-500 dark:text-gray-400">Please login to manage your knowledge base.</p>
                    </div>
                    <div className="space-y-3">
                        <Link href="/auth?mode=login&redirect=/knowledge" className="block">
                            <Button className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl">Login Now</Button>
                        </Link>
                        <Link href="/dashboard" className="block">
                            <Button variant="ghost" className="w-full text-gray-500 hover:text-gray-900 dark:hover:text-white">Back to Dashboard</Button>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen relative bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
            <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10 animate-mac-fade-in">
                {/* macOS-style Title Bar */}
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard">
                            <Button variant="ghost" size="icon" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800 rounded-lg">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">
                                Knowledge Base
                            </h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                Manage RAG documents and build your personal knowledge graph
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={handleRebuild}
                            disabled={rebuilding}
                            className="gap-2 border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-sm"
                        >
                            <RefreshCw className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
                            {rebuilding ? 'Rebuilding...' : 'Rebuild Index'}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 mt-6 md:grid-cols-3">
                    {/* Upload Area - macOS Finder sidebar style */}
                    <div className="md:col-span-1">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm">
                            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <Upload className="h-4 w-4 text-purple-500" />
                                Upload Document
                            </h3>
                            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-all cursor-pointer relative flex flex-col items-center justify-center group">
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    onChange={handleFileUpload}
                                    disabled={uploading}
                                    accept=".pdf,.txt,.md,.markdown,.json,.csv,.yaml,.yml,.xml,.html,.htm,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.rtf,.odt,.ods,.odp,.py,.js,.ts,.tsx,.jsx,.java,.c,.cpp,.go,.rs,.log,.ini"
                                />
                                <div className="h-12 w-12 rounded-full bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                    {uploading ? (
                                        <Loader2 className="h-6 w-6 text-purple-500 animate-spin" />
                                    ) : (
                                        <Upload className="h-6 w-6 text-purple-500" />
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <p className="font-medium text-sm text-gray-700 dark:text-gray-300">
                                        {uploading ? 'Uploading...' : 'Click or Drag files'}
                                    </p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500">
                                        PDF, TXT, MD, DOCX, JSON, CSV...
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* File List - macOS Finder list style */}
                    <div className="md:col-span-2">
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
                            {/* macOS Finder-style toolbar header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                                <div className="flex items-center gap-3">
                                    <FileText className="h-4 w-4 text-purple-500" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Documents
                                    </span>
                                    <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{files.length}</span>
                                </div>
                            </div>

                            {/* macOS Finder-style search bar */}
                            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        type="text"
                                        placeholder="Search documents..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 h-9 text-sm bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg focus-visible:ring-purple-500 focus-visible:border-purple-500"
                                    />
                                </div>
                            </div>

                            {/* File list */}
                            {loading ? (
                                <div className="flex justify-center py-16">
                                    <Loader2 className="h-6 w-6 animate-spin text-purple-500/50" />
                                </div>
                            ) : filteredFiles.length === 0 ? (
                                <div className="text-center py-16 text-gray-400 dark:text-gray-500 flex flex-col items-center">
                                    <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                                        <FileText className="h-6 w-6 opacity-50" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                        {searchQuery ? 'No matching documents found.' : 'No documents found.'}
                                    </p>
                                    <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                                        {searchQuery ? 'Try a different search term.' : 'Upload files to get started.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {filteredFiles.map((file, idx) => (
                                        <div
                                            key={file.name}
                                            className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors animate-mac-slide-in group"
                                            style={{ animationDelay: `${idx * 30}ms`, animationFillMode: 'both' }}
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                {getFileTypeIcon(file.name, 'h-6 w-6')}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={file.name}>
                                                            {file.name}
                                                        </p>
                                                        <span className="text-[10px] font-medium text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded flex-shrink-0">
                                                            {getFileTypeLabel(file.name)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                                                        {formatSize(file.size)} · {formatDate(file.modified)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg"
                                                    onClick={() => openPreview(file.name)}
                                                    title="预览文档"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
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

            {/* Preview Dialog */}
            <Dialog open={previewState.open} onOpenChange={(open) => !open && closePreview()}>
                <DialogContent className="max-w-4xl max-h-[85vh] bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                    <DialogHeader>
                        <DialogTitle className="truncate pr-10 text-gray-900 dark:text-white">文档预览: {previewState.fileName}</DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">
                            {previewState.isPdf ? '原生 PDF 预览（保留图片与排版）' : '在线查看文档解析内容'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="h-[62vh] rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        {previewState.isPdf ? (
                            <iframe key={previewState.rawUrl} src={previewState.rawUrl} className="h-full w-full rounded-xl border-0 bg-white" title={`PDF Preview: ${previewState.fileName}`} />
                        ) : (
                            <ScrollArea className="h-full w-full p-4">
                                {previewState.loading ? (
                                    <div className="h-full min-h-[240px] flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />正在加载文档内容...
                                    </div>
                                ) : previewState.error ? (
                                    <div className="rounded-lg border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 p-4 text-sm flex gap-2">
                                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                        <span>{previewState.error}</span>
                                    </div>
                                ) : isMarkdownFile(previewState.fileName) ? (
                                    <MarkdownPreview content={previewState.content || '暂无内容'} />
                                ) : (
                                    <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 dark:text-gray-200 font-mono">
                                        {previewState.content || '暂无内容'}
                                    </pre>
                                )}
                            </ScrollArea>
                        )}
                    </div>
                    {!previewState.isPdf && previewState.truncated && !previewState.loading && !previewState.error && (
                        <p className="text-xs text-amber-600 dark:text-amber-300/90">
                            文档较长，当前仅展示前 {previewState.maxChars.toLocaleString()} 字内容（原文 {previewState.charCount.toLocaleString()} 字）。
                        </p>
                    )}
                </DialogContent>
            </Dialog>

            {/* Rebuild status Dialog */}
            <Dialog open={showRebuildStatus} onOpenChange={setShowRebuildStatus}>
                <DialogContent className="max-w-md bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white">
                    <DialogHeader>
                        <DialogTitle className="text-gray-900 dark:text-white">索引重建状态</DialogTitle>
                        <DialogDescription className="text-gray-500 dark:text-gray-400">查看索引重建任务的实时进度</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        {rebuildStatus ? (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    {rebuildStatus.status === 'completed' ? (
                                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                                            <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    ) : rebuildStatus.status === 'failed' ? (
                                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                        </div>
                                    ) : (
                                        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                                    )}
                                    <div>
                                        <p className="font-medium text-gray-900 dark:text-white">
                                            {rebuildStatus.status === 'completed' ? '已完成' : rebuildStatus.status === 'failed' ? '失败' : rebuildStatus.status === 'running' ? '进行中' : '等待中'}
                                        </p>
                                        {rebuildStatus.message && <p className="text-sm text-gray-500 dark:text-gray-400">{rebuildStatus.message}</p>}
                                    </div>
                                </div>
                                {rebuildStatus.error && (
                                    <div className="rounded-lg border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-200 p-3 text-sm">
                                        {rebuildStatus.error}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center py-4">
                                <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
