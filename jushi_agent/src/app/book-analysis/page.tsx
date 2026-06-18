'use client'

import Link from 'next/link'
import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Loader2,
  PlayCircle,
  Plus,
  RefreshCw,
  Save,
  Upload,
  Trash2,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { BookAnalysisChapter, BookAnalysisProject } from '@/types/book-analysis'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

function cloneChapters(chapters: BookAnalysisChapter[]): BookAnalysisChapter[] {
  return chapters.map((chapter) => ({
    ...chapter,
    keyPoints: [...chapter.keyPoints],
    arguments: [...chapter.arguments],
    examples: [...chapter.examples],
    evidence: [...chapter.evidence],
    quotedEvidence: [...chapter.quotedEvidence],
    openQuestions: [...chapter.openQuestions],
  }))
}

function projectStatusLabel(status: string) {
  switch (status) {
    case 'draft': return '待分析'
    case 'running': return '分析中'
    case 'completed': return '已完成'
    case 'completed_with_errors': return '已完成（含异常）'
    case 'failed': return '失败'
    default: return status
  }
}

function projectStatusColor(status: string) {
  switch (status) {
    case 'draft': return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
    case 'running': return 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300'
    case 'completed': return 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300'
    case 'completed_with_errors': return 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300'
    case 'failed': return 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300'
    default: return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }
}

export default function BookAnalysisPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const [projects, setProjects] = useState<BookAnalysisProject[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [starting, setStarting] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [draftChapters, setDraftChapters] = useState<BookAnalysisChapter[]>([])
  const [draftTitle, setDraftTitle] = useState('')

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId]
  )

  const draftDirty = useMemo(() => {
    if (!selectedProject) return false
    return JSON.stringify(selectedProject.chapters) !== JSON.stringify(draftChapters)
  }, [selectedProject, draftChapters])

  const draftValidationError = useMemo(() => {
    if (!draftChapters.length) return '至少保留一个章节'
    let previousEnd = 0
    for (const chapter of draftChapters) {
      const title = chapter.title.trim()
      if (!title) return '章节标题不能为空'
      if (chapter.startPage < 1 || chapter.endPage < 1) return '页码必须大于 0'
      if (chapter.startPage > chapter.endPage) return `《${title}》起始页不能大于结束页`
      if (selectedProject && chapter.endPage > selectedProject.pageCount)
        return `《${title}》页码超出总页数`
      if (chapter.startPage <= previousEnd) return '章节页码必须按顺序且不能重叠'
      previousEnd = chapter.endPage
    }
    return ''
  }, [draftChapters, selectedProject])

  const loadProjects = async (preserveSelection = true) => {
    try {
      setLoading(true)
      const response = await fetch(API_ENDPOINTS.BOOK_ANALYSIS.PROJECTS, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result?.detail || result?.error || '获取项目列表失败')
      const nextProjects = (result.data?.projects || []) as BookAnalysisProject[]
      setProjects(nextProjects)
      if (!preserveSelection || !selectedProjectId) setSelectedProjectId(nextProjects[0]?.id || null)
      else if (!nextProjects.some((p) => p.id === selectedProjectId)) setSelectedProjectId(nextProjects[0]?.id || null)
    } catch (error) {
      toast({ title: '加载失败', description: error instanceof Error ? error.message : '无法获取书籍分析项目', variant: 'destructive' })
    } finally { setLoading(false) }
  }

  useEffect(() => { if (isAuthenticated) loadProjects(false) }, [isAuthenticated])
  useEffect(() => {
    if (!selectedProject) { setDraftChapters([]); return }
    setDraftChapters(cloneChapters(selectedProject.chapters))
  }, [selectedProjectId, selectedProject?.updatedAt])
  useEffect(() => {
    if (!selectedProject || selectedProject.status !== 'running') return
    const timer = setInterval(() => loadProjects(true), 3000)
    return () => clearInterval(timer)
  }, [selectedProject?.id, selectedProject?.status])

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      setCreating(true)
      const formData = new FormData()
      formData.append('file', file)
      if (draftTitle.trim()) formData.append('title', draftTitle.trim())
      const response = await fetch(API_ENDPOINTS.BOOK_ANALYSIS.PROJECTS, { method: 'POST', body: formData })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result?.detail || result?.error || '创建项目失败')
      const project = result.data.project as BookAnalysisProject
      setProjects((current) => [project, ...current])
      setSelectedProjectId(project.id)
      setDraftTitle('')
      toast({ title: '项目已创建', description: `《${project.title}》已上传，继续校正章节后即可开始分析。` })
    } catch (error) {
      toast({ title: '上传失败', description: error instanceof Error ? error.message : '无法创建项目', variant: 'destructive' })
    } finally { setCreating(false); event.target.value = '' }
  }

  const handleSaveChapters = async () => {
    if (!selectedProject) return
    if (draftValidationError) { toast({ title: '章节校验失败', description: draftValidationError, variant: 'destructive' }); return }
    try {
      setSaving(true)
      const response = await fetch(API_ENDPOINTS.BOOK_ANALYSIS.PROJECT_CHAPTERS(selectedProject.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapters: draftChapters.map((ch) => ({ title: ch.title, startPage: ch.startPage, endPage: ch.endPage })) }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result?.detail || result?.error || '保存章节失败')
      const project = result.data.project as BookAnalysisProject
      setProjects((current) => current.map((item) => (item.id === project.id ? project : item)))
      setSelectedProjectId(project.id)
      toast({ title: '章节已保存', description: '现在可以启动 NotebookLM 逐章分析。' })
    } catch (error) {
      toast({ title: '保存失败', description: error instanceof Error ? error.message : '无法保存章节', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const handleStart = async () => {
    if (!selectedProject) return
    if (draftDirty) { toast({ title: '请先保存章节', description: '章节草稿已变更，请先保存后再启动分析。', variant: 'destructive' }); return }
    if (draftValidationError) { toast({ title: '章节校验失败', description: draftValidationError, variant: 'destructive' }); return }
    try {
      setStarting(true)
      const response = await fetch(API_ENDPOINTS.BOOK_ANALYSIS.PROJECT_RUN(selectedProject.id), { method: 'POST' })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result?.detail || result?.error || '启动分析失败')
      const project = result.data.project as BookAnalysisProject
      setProjects((current) => current.map((item) => (item.id === project.id ? project : item)))
      toast({ title: '分析已启动', description: 'NotebookLM 正在逐章处理，请保持页面开启或稍后回来查看。' })
    } catch (error) {
      toast({ title: '启动失败', description: error instanceof Error ? error.message : '无法启动分析', variant: 'destructive' })
    } finally { setStarting(false) }
  }

  const handleRemoveChapter = (index: number) => setDraftChapters((current) => current.filter((_, i) => i !== index))
  const handleAddChapter = () => {
    const lastChapter = draftChapters[draftChapters.length - 1]
    const nextStart = lastChapter ? lastChapter.endPage + 1 : 1
    const nextEnd = selectedProject ? Math.min(nextStart, selectedProject.pageCount) : nextStart
    setDraftChapters((current) => [...current, {
      id: crypto.randomUUID(), title: `新章节 ${current.length + 1}`, startPage: nextStart, endPage: nextEnd,
      status: 'draft', summary: '', keyPoints: [], arguments: [], examples: [], evidence: [],
      quotedEvidence: [], openQuestions: [], rawAnswer: '', error: null,
    }])
  }

  const updateChapter = (index: number, patch: Partial<BookAnalysisChapter>) =>
    setDraftChapters((current) => current.map((ch, i) => (i === index ? { ...ch, ...patch } : ch)))

  if (authLoading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500/70" />
          <p className="text-gray-400 dark:text-gray-500 text-sm uppercase tracking-[0.3em]">Loading Book Analysis</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-gray-950 dark:via-gray-900 dark:to-purple-950">
      <div className="mx-auto max-w-7xl px-6 py-10 animate-mac-fade-in">
        {/* macOS-style header toolbar */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400 shadow-sm">
              <BookOpen className="h-3.5 w-3.5 text-purple-500" />
              NotebookLM Book Analysis
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">书籍逐章分析</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              上传一本 PDF，校正章节范围，调用 NotebookLM 做逐章分析，并在双栏阅读页中同时查看原文与分析结果。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-sm" onClick={() => loadProjects(true)}>
              <RefreshCw className="mr-2 h-4 w-4" />刷新项目
            </Button>
            {selectedProject && (
              <Link href={`/book-analysis/${selectedProject.id}`}>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm">
                  打开阅读页 <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* macOS-style sidebar + content layout */}
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          {/* Left Sidebar - macOS Finder style */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            {/* Sidebar header */}
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">项目列表</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">选择或创建一个书籍分析项目</p>
            </div>

            <div className="p-4 space-y-4">
              {/* Upload section */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                <label className="mb-2 block text-xs font-medium text-gray-500 dark:text-gray-400">可选书名</label>
                <Input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="默认使用 PDF 文件名"
                  className="h-8 text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-lg"
                />
                <label className="mt-3 block cursor-pointer">
                  <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} disabled={creating} />
                  <span className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {creating ? '正在上传并提取章节...' : '上传 PDF 创建项目'}
                  </span>
                </label>
              </div>

              {/* Project list */}
              <div className="space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-8 text-xs text-gray-400">
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />加载项目中...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-8 text-center text-xs text-gray-400">
                    还没有书籍分析项目，先上传一本书。
                  </div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-all ${
                        project.id === selectedProjectId
                          ? 'border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-500/10 shadow-sm'
                          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{project.title}</div>
                          <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">{project.originalFilename}</div>
                        </div>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${projectStatusColor(project.status)}`}>
                          {projectStatusLabel(project.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                        章节 {project.totalChapters} · 进度 {project.progressPercent}%
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Content - macOS style white panel */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
            {/* macOS-style toolbar */}
            <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">章节草稿与任务控制</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">调整章节名与页码范围，保存后即可触发 NotebookLM 逐章分析。</p>
            </div>

            <div className="p-5 space-y-5">
              {!selectedProject ? (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-6 py-16 text-center text-sm text-gray-400">
                  选择左侧项目后即可编辑章节。
                </div>
              ) : (
                <>
                  {/* Stats cards - macOS card style */}
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      { label: '总页数', value: selectedProject.pageCount },
                      { label: '章节数', value: draftChapters.length },
                      { label: '当前状态', value: projectStatusLabel(selectedProject.status) },
                      { label: '阶段', value: selectedProject.currentStage || 'draft' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-gray-500">{stat.label}</div>
                        <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{stat.value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedProject.error && (
                    <div className="rounded-lg border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-2.5 text-sm text-red-700 dark:text-red-300">
                      {selectedProject.error}
                    </div>
                  )}

                  {/* Chapter table - macOS Finder style */}
                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">章节标题</th>
                          <th className="w-24 text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">起始页</th>
                          <th className="w-24 text-left px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">结束页</th>
                          <th className="w-20 text-right px-4 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {draftChapters.map((chapter, index) => (
                          <tr key={chapter.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <td className="px-4 py-2">
                              <Input
                                value={chapter.title}
                                onChange={(e) => updateChapter(index, { title: e.target.value })}
                                className="h-8 text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg"
                                disabled={selectedProject.status === 'running'}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number" min={1} max={selectedProject.pageCount}
                                value={chapter.startPage}
                                onChange={(e) => updateChapter(index, { startPage: Number(e.target.value) || 1 })}
                                className="h-8 text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg"
                                disabled={selectedProject.status === 'running'}
                              />
                            </td>
                            <td className="px-4 py-2">
                              <Input
                                type="number" min={1} max={selectedProject.pageCount}
                                value={chapter.endPage}
                                onChange={(e) => updateChapter(index, { endPage: Number(e.target.value) || 1 })}
                                className="h-8 text-sm border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg"
                                disabled={selectedProject.status === 'running'}
                              />
                            </td>
                            <td className="px-4 py-2 text-right">
                              <Button
                                variant="ghost" size="sm"
                                onClick={() => handleRemoveChapter(index)}
                                disabled={selectedProject.status === 'running' || draftChapters.length <= 1}
                                className="h-8 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Action bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Button variant="outline" className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-sm" onClick={handleAddChapter} disabled={selectedProject.status === 'running'}>
                        <Plus className="mr-2 h-4 w-4" />新增章节
                      </Button>
                      {draftValidationError && <span className="text-xs text-amber-600 dark:text-amber-400">{draftValidationError}</span>}
                      {!draftValidationError && draftDirty && <span className="text-xs text-gray-400">章节草稿已变更，记得先保存。</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" className="border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl text-sm" onClick={handleSaveChapters} disabled={saving || selectedProject.status === 'running'}>
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}保存章节
                      </Button>
                      <Button onClick={handleStart} disabled={starting || selectedProject.status === 'running' || !!draftValidationError} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm disabled:bg-purple-400 dark:disabled:bg-purple-800">
                        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}启动分析
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400">
                    {selectedProject.status === 'running'
                      ? `正在执行第 ${selectedProject.currentChapterIndex || 0} / ${selectedProject.totalChapters} 章，当前阶段：${selectedProject.currentStage}`
                      : '流程：上传 PDF → 修正章节 → 保存 → 启动分析 → 打开阅读页。'}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
