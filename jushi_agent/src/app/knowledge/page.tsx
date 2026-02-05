'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { Loader2, Upload, Trash2, RefreshCw, FileText, ArrowLeft, Database, Search } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/components/ui/use-toast'
import { JushiBackground } from '@/components/ui/JushiBackground'

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
                                        accept=".pdf,.txt,.md,.json,.csv,.docx"
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
                                            PDF, TXT, MD, DOCX
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
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-white/30 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                                    onClick={() => handleDelete(file.name)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
