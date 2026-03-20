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
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { JushiBackground } from '@/components/ui/JushiBackground'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { BookAnalysisChapter, BookAnalysisProject } from '@/types/book-analysis'
import { cn } from '@/lib/utils'

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
    case 'draft':
      return '待分析'
    case 'running':
      return '分析中'
    case 'completed':
      return '已完成'
    case 'completed_with_errors':
      return '已完成（含异常）'
    case 'failed':
      return '失败'
    default:
      return status
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
      if (selectedProject && chapter.endPage > selectedProject.pageCount) {
        return `《${title}》页码超出总页数`
      }
      if (chapter.startPage <= previousEnd) return '章节页码必须按顺序且不能重叠'
      previousEnd = chapter.endPage
    }
    return ''
  }, [draftChapters, selectedProject])

  const loadProjects = async (preserveSelection = true) => {
    try {
      setLoading(true)
      const response = await fetch('/api/book-analysis/projects', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.detail || result?.error || '获取项目列表失败')
      }
      const nextProjects = (result.data?.projects || []) as BookAnalysisProject[]
      setProjects(nextProjects)

      if (!preserveSelection || !selectedProjectId) {
        setSelectedProjectId(nextProjects[0]?.id || null)
      } else if (!nextProjects.some((project) => project.id === selectedProjectId)) {
        setSelectedProjectId(nextProjects[0]?.id || null)
      }
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '无法获取书籍分析项目',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      void loadProjects(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!selectedProject) {
      setDraftChapters([])
      return
    }
    setDraftChapters(cloneChapters(selectedProject.chapters))
  }, [selectedProjectId, selectedProject?.updatedAt])

  useEffect(() => {
    if (!selectedProject || selectedProject.status !== 'running') return
    const timer = setInterval(() => {
      void loadProjects(true)
    }, 3000)
    return () => clearInterval(timer)
  }, [selectedProject?.id, selectedProject?.status])

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      setCreating(true)
      const formData = new FormData()
      formData.append('file', file)
      if (draftTitle.trim()) {
        formData.append('title', draftTitle.trim())
      }

      const response = await fetch('/api/book-analysis/projects', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.detail || result?.error || '创建项目失败')
      }
      const project = result.data.project as BookAnalysisProject
      setProjects((current) => [project, ...current])
      setSelectedProjectId(project.id)
      setDraftTitle('')
      toast({
        title: '项目已创建',
        description: `《${project.title}》已上传，继续校正章节后即可开始分析。`,
      })
    } catch (error) {
      toast({
        title: '上传失败',
        description: error instanceof Error ? error.message : '无法创建项目',
        variant: 'destructive',
      })
    } finally {
      setCreating(false)
      event.target.value = ''
    }
  }

  const updateChapter = (index: number, patch: Partial<BookAnalysisChapter>) => {
    setDraftChapters((current) =>
      current.map((chapter, chapterIndex) => (chapterIndex === index ? { ...chapter, ...patch } : chapter))
    )
  }

  const handleAddChapter = () => {
    const lastChapter = draftChapters[draftChapters.length - 1]
    const nextStart = lastChapter ? lastChapter.endPage + 1 : 1
    const nextEnd = selectedProject ? Math.min(nextStart, selectedProject.pageCount) : nextStart
    setDraftChapters((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: `新章节 ${current.length + 1}`,
        startPage: nextStart,
        endPage: nextEnd,
        status: 'draft',
        summary: '',
        keyPoints: [],
        arguments: [],
        examples: [],
        evidence: [],
        quotedEvidence: [],
        openQuestions: [],
        rawAnswer: '',
        error: null,
      },
    ])
  }

  const handleRemoveChapter = (index: number) => {
    setDraftChapters((current) => current.filter((_, chapterIndex) => chapterIndex !== index))
  }

  const handleSaveChapters = async () => {
    if (!selectedProject) return
    if (draftValidationError) {
      toast({
        title: '章节校验失败',
        description: draftValidationError,
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      const response = await fetch(`/api/book-analysis/projects/${selectedProject.id}/chapters`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chapters: draftChapters.map((chapter) => ({
            title: chapter.title,
            startPage: chapter.startPage,
            endPage: chapter.endPage,
          })),
        }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.detail || result?.error || '保存章节失败')
      }
      const project = result.data.project as BookAnalysisProject
      setProjects((current) => current.map((item) => (item.id === project.id ? project : item)))
      setSelectedProjectId(project.id)
      toast({
        title: '章节已保存',
        description: '现在可以启动 NotebookLM 逐章分析。',
      })
    } catch (error) {
      toast({
        title: '保存失败',
        description: error instanceof Error ? error.message : '无法保存章节',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleStart = async () => {
    if (!selectedProject) return
    if (draftDirty) {
      toast({
        title: '请先保存章节',
        description: '章节草稿已变更，请先保存后再启动分析。',
        variant: 'destructive',
      })
      return
    }
    if (draftValidationError) {
      toast({
        title: '章节校验失败',
        description: draftValidationError,
        variant: 'destructive',
      })
      return
    }
    try {
      setStarting(true)
      const response = await fetch(`/api/book-analysis/projects/${selectedProject.id}/run`, {
        method: 'POST',
      })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.detail || result?.error || '启动分析失败')
      }
      const project = result.data.project as BookAnalysisProject
      setProjects((current) => current.map((item) => (item.id === project.id ? project : item)))
      toast({
        title: '分析已启动',
        description: 'NotebookLM 正在逐章处理，请保持页面开启或稍后回来查看。',
      })
    } catch (error) {
      toast({
        title: '启动失败',
        description: error instanceof Error ? error.message : '无法启动分析',
        variant: 'destructive',
      })
    } finally {
      setStarting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden">
        <JushiBackground blur="xl" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-white/50" />
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">Loading Book Analysis</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen relative overflow-hidden">
      <JushiBackground blur="lg" opacity={0.45} />
      <div className="relative z-10 mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur-xl">
              <BookOpen className="h-4 w-4" />
              NotebookLM Book Analysis
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white">书籍逐章分析</h1>
            <p className="mt-2 max-w-3xl text-white/70">
              上传一本 PDF，校正章节范围，调用 NotebookLM 做逐章分析，并在双栏阅读页中同时查看原文与分析结果。
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-white/15 bg-white/10 text-white hover:bg-white/15"
              onClick={() => void loadProjects(true)}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新项目
            </Button>
            {selectedProject && (
              <Link href={`/book-analysis/${selectedProject.id}`}>
                <Button className="bg-emerald-500 text-white hover:bg-emerald-400">
                  打开阅读页
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
          <Card className="border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">项目列表</CardTitle>
              <CardDescription className="text-white/60">
                第一版按单本书流程设计，先把一本书跑通，再扩展批量处理。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
                <label className="mb-2 block text-sm text-white/70">可选书名</label>
                <Input
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  placeholder="默认使用 PDF 文件名"
                  className="border-white/10 bg-white/10 text-white placeholder:text-white/35"
                />
                <label className="mt-4 block">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={handleUpload}
                    disabled={creating}
                  />
                  <span className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-sm text-white/80 transition hover:bg-white/10">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {creating ? '正在上传并提取章节...' : '上传 PDF 创建项目'}
                  </span>
                </label>
              </div>

              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-white/60">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    加载项目中...
                  </div>
                ) : projects.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/55">
                    还没有书籍分析项目，先上传一本书。
                  </div>
                ) : (
                  projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => setSelectedProjectId(project.id)}
                      className={cn(
                        'w-full rounded-2xl border px-4 py-4 text-left transition',
                        project.id === selectedProjectId
                          ? 'border-emerald-300/40 bg-emerald-400/15'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-white">{project.title}</div>
                          <div className="mt-1 text-xs text-white/55">{project.originalFilename}</div>
                        </div>
                        <Badge className="border-0 bg-white/10 text-white">{projectStatusLabel(project.status)}</Badge>
                      </div>
                      <div className="mt-3 text-xs text-white/60">
                        章节 {project.totalChapters} · 进度 {project.progressPercent}%
                      </div>
                    </button>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">章节草稿与任务控制</CardTitle>
              <CardDescription className="text-white/60">
                调整章节名与页码范围，保存后即可触发 NotebookLM 逐章分析。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!selectedProject ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center text-white/55">
                  选择左侧项目后即可编辑章节。
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-white/40">总页数</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{selectedProject.pageCount}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-white/40">章节数</div>
                      <div className="mt-2 text-2xl font-semibold text-white">{draftChapters.length}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-white/40">当前状态</div>
                      <div className="mt-2 text-lg font-semibold text-white">{projectStatusLabel(selectedProject.status)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.24em] text-white/40">阶段</div>
                      <div className="mt-2 text-sm font-medium text-white/75">{selectedProject.currentStage || 'draft'}</div>
                    </div>
                  </div>

                  {selectedProject.error && (
                    <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                      {selectedProject.error}
                    </div>
                  )}

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-3">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead className="text-white/60">章节标题</TableHead>
                          <TableHead className="w-28 text-white/60">起始页</TableHead>
                          <TableHead className="w-28 text-white/60">结束页</TableHead>
                          <TableHead className="w-24 text-right text-white/60">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {draftChapters.map((chapter, index) => (
                          <TableRow key={chapter.id} className="border-white/10 hover:bg-white/5">
                            <TableCell>
                              <Input
                                value={chapter.title}
                                onChange={(event) => updateChapter(index, { title: event.target.value })}
                                className="border-white/10 bg-white/10 text-white placeholder:text-white/30"
                                disabled={selectedProject.status === 'running'}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                max={selectedProject.pageCount}
                                value={chapter.startPage}
                                onChange={(event) => updateChapter(index, { startPage: Number(event.target.value) || 1 })}
                                className="border-white/10 bg-white/10 text-white"
                                disabled={selectedProject.status === 'running'}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                max={selectedProject.pageCount}
                                value={chapter.endPage}
                                onChange={(event) => updateChapter(index, { endPage: Number(event.target.value) || 1 })}
                                className="border-white/10 bg-white/10 text-white"
                                disabled={selectedProject.status === 'running'}
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveChapter(index)}
                                disabled={selectedProject.status === 'running' || draftChapters.length <= 1}
                                className="text-white/70 hover:bg-white/10 hover:text-white"
                              >
                                删除
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        className="border-white/15 bg-white/10 text-white hover:bg-white/15"
                        onClick={handleAddChapter}
                        disabled={selectedProject.status === 'running'}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        新增章节
                      </Button>
                      {draftValidationError && (
                        <span className="text-sm text-amber-200">{draftValidationError}</span>
                      )}
                      {!draftValidationError && draftDirty && (
                        <span className="text-sm text-white/60">章节草稿已变更，记得先保存。</span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        className="border-white/15 bg-white/10 text-white hover:bg-white/15"
                        onClick={handleSaveChapters}
                        disabled={saving || selectedProject.status === 'running'}
                      >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        保存章节
                      </Button>
                      <Button
                        onClick={handleStart}
                        disabled={starting || selectedProject.status === 'running' || !!draftValidationError}
                        className="bg-emerald-500 text-white hover:bg-emerald-400 disabled:bg-emerald-500/40"
                      >
                        {starting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                        启动分析
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
                    {selectedProject.status === 'running'
                      ? `正在执行第 ${selectedProject.currentChapterIndex || 0} / ${selectedProject.totalChapters} 章，当前阶段：${selectedProject.currentStage}`
                      : '流程：上传 PDF -> 修正章节 -> 保存 -> 启动分析 -> 打开阅读页。'}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
