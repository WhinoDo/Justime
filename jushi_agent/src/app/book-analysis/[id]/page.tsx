'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  BookOpen,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookAnalysisProject } from '@/types/book-analysis'
import { API_ENDPOINTS } from '@/lib/api/endpoints'

function statusLabel(status: string) {
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

function renderList(title: string, items: string[]) {
  if (!items?.length) return null
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <h3 className="mb-3 text-xs uppercase tracking-[0.28em] text-white/45">{title}</h3>
      <ul className="space-y-2 text-sm text-white/80">
        {items.map((item, index) => (
          <li key={`${title}-${index}`} className="rounded-xl bg-black/10 px-3 py-2 leading-7">
            {item}
          </li>
        ))}
      </ul>
    </section>
  )
}

export default function BookAnalysisDetailPage({ params }: { params: { id: string } }) {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const [project, setProject] = useState<BookAnalysisProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedChapterIndex, setSelectedChapterIndex] = useState(0)

  const selectedChapter = useMemo(
    () => project?.chapters?.[selectedChapterIndex] || null,
    [project, selectedChapterIndex]
  )

  const loadProject = async () => {
    try {
      setLoading(true)
      const response = await fetch(API_ENDPOINTS.BOOK_ANALYSIS.PROJECT(params.id), { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok || !result.success) {
        throw new Error(result?.detail || result?.error || '获取项目失败')
      }
      const nextProject = result.data.project as BookAnalysisProject
      setProject(nextProject)
      setSelectedChapterIndex((current) => Math.min(current, Math.max(0, nextProject.chapters.length - 1)))
    } catch (error) {
      toast({
        title: '加载失败',
        description: error instanceof Error ? error.message : '无法读取项目详情',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      void loadProject()
    }
  }, [isAuthenticated, params.id])

  useEffect(() => {
    if (!project || project.status !== 'running') return
    const timer = setInterval(() => {
      void loadProject()
    }, 3000)
    return () => clearInterval(timer)
  }, [project?.status, project?.id])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-background">
        <div className="relative z-10 flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-white/50" />
          <p className="text-sm uppercase tracking-[0.3em] text-white/60">Loading Reader</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !project) return null

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      <div className="relative z-10 mx-auto max-w-[1600px] px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/book-analysis">
              <Button variant="outline" className="border-white/15 bg-white/10 text-white hover:bg-white/15">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回项目列表
              </Button>
            </Link>
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm text-white/80 backdrop-blur-xl">
                <BookOpen className="h-4 w-4" />
                双栏阅读页
              </div>
              <h1 className="text-3xl font-semibold text-white">{project.title}</h1>
              <p className="mt-1 text-sm text-white/60">
                {project.originalFilename} · 章节 {project.totalChapters} · 进度 {project.progressPercent}%
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge className="border-0 bg-white/10 px-3 py-2 text-white">{statusLabel(project.status)}</Badge>
            <Button
              variant="outline"
              className="border-white/15 bg-white/10 text-white hover:bg-white/15"
              onClick={() => void loadProject()}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              刷新
            </Button>
            {project.exportHtmlPath && (
              <a href={API_ENDPOINTS.KNOWLEDGE.RAW(project.exportHtmlPath)} target="_blank" rel="noreferrer">
                <Button className="bg-emerald-500 text-white hover:bg-emerald-400">
                  <Download className="mr-2 h-4 w-4" />
                  打开导出 HTML
                </Button>
              </a>
            )}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(560px,1.2fr),minmax(360px,.9fr)]">
          <Card className="border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-white">原始 PDF</CardTitle>
              <span className="text-sm text-white/55">左侧保持原书，右侧切换章节分析</span>
            </CardHeader>
            <CardContent>
              <iframe
                src={API_ENDPOINTS.KNOWLEDGE.RAW(project.sourcePath)}
                className="h-[78vh] w-full rounded-2xl border-0 bg-white"
                title={project.title}
              />
            </CardContent>
          </Card>

          <Card className="border-white/15 bg-white/10 text-white shadow-2xl backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-white">章节分析</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {project.error && (
                <div className="rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                  {project.error}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {project.chapters.map((chapter, index) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => setSelectedChapterIndex(index)}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      index === selectedChapterIndex
                        ? 'border-emerald-300/40 bg-emerald-400/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {index + 1}. {chapter.title}
                  </button>
                ))}
              </div>

              {!selectedChapter ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-white/55">
                  暂无章节结果
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-xl font-semibold text-white">{selectedChapter.title}</h2>
                        <p className="mt-1 text-sm text-white/55">
                          页码 {selectedChapter.startPage} - {selectedChapter.endPage}
                        </p>
                      </div>
                      <Badge className="border-0 bg-white/10 text-white">{statusLabel(selectedChapter.status)}</Badge>
                    </div>
                  </div>

                  {selectedChapter.error && (
                    <div className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                      {selectedChapter.error}
                    </div>
                  )}

                  <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h3 className="mb-3 text-xs uppercase tracking-[0.28em] text-white/45">章节摘要</h3>
                    <p className="whitespace-pre-wrap text-sm leading-7 text-white/82">
                      {selectedChapter.summary || '该章节尚未生成摘要。'}
                    </p>
                  </section>

                  {renderList('关键点', selectedChapter.keyPoints)}
                  {renderList('论点', selectedChapter.arguments)}
                  {renderList('例子', selectedChapter.examples)}
                  {renderList('开放问题', selectedChapter.openQuestions)}
                  {renderList('证据', selectedChapter.quotedEvidence)}

                  {selectedChapter.rawAnswer && selectedChapter.status !== 'completed' && (
                    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <h3 className="mb-3 text-xs uppercase tracking-[0.28em] text-white/45">原始回答</h3>
                      <pre className="overflow-auto whitespace-pre-wrap rounded-xl bg-black/15 p-4 text-xs leading-6 text-white/75">
                        {selectedChapter.rawAnswer}
                      </pre>
                    </section>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
