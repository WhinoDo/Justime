'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Upload, FileText, ExternalLink, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { StudyMaterial, Subject } from '@/types/study'
import { API_ENDPOINTS } from '@/lib/api/endpoints'
import { cn } from '@/lib/utils'

const subjectFilters: (Subject | 'all')[] = ['all', '数学', '英语', '政治', '专业课']

const subjectColors: Record<Subject, string> = {
  '数学': 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  '英语': 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  '政治': 'bg-violet-500/20 text-violet-200 border-violet-400/30',
  '专业课': 'bg-purple-500/20 text-purple-200 border-purple-400/30',
}

export default function MaterialsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const [materials, setMaterials] = useState<StudyMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Subject | 'all'>('all')
  const [uploading, setUploading] = useState(false)

  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(API_ENDPOINTS.STUDY.MATERIALS)
      const data = await res.json()
      if (data.success && data.data) {
        setMaterials(data.data.materials || data.data || [])
      } else {
        setMaterials([])
      }
    } catch {
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMaterials() }, [fetchMaterials])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(API_ENDPOINTS.STUDY.MATERIALS, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.success) {
        await fetchMaterials()
      }
    } catch {
      // ignore
    } finally {
      setUploading(false)
    }
  }

  const filtered = filter === 'all' ? materials : materials.filter(m => m.subject === filter)

  if (authLoading) {
    return (
      <JustimePageShell blur="xl" contentClassName="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </JustimePageShell>
    )
  }

  if (!isAuthenticated || !user) return null

  return (
    <JustimePageShell fullHeight blur="lg" opacity={0.4} contentClassName="h-full overflow-y-auto">
      <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-4 pb-8">
        <div className="flex items-center justify-between bg-muted/50 backdrop-blur-xl p-4 rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-3">
            <Link href="/study">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-accent/50 hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-300" />
                学习资料
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">{materials.length} 份资料</p>
            </div>
          </div>

          <label>
            <input
              type="file"
              className="hidden"
              onChange={handleUpload}
              accept=".pdf,.doc,.docx,.txt,.md"
            />
            <Button
              asChild
              disabled={uploading}
              className="bg-emerald-600 hover:bg-emerald-500 text-foreground border-0 shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <span>
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                上传资料
              </span>
            </Button>
          </label>
        </div>

        <div className="flex gap-2">
          {subjectFilters.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border transition-all',
                filter === s
                  ? 'bg-accent/60 border-border text-foreground'
                  : 'bg-muted/30 border-border text-muted-foreground hover:bg-accent/50'
              )}
            >
              {s === 'all' ? '全部' : s}
            </button>
          ))}
        </div>

        <JustimeGlassPanel className="rounded-2xl p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-foreground/10 mx-auto mb-4" />
              <p className="text-foreground/50 text-sm mb-1">暂无学习资料</p>
              <p className="text-muted-foreground/50 text-xs">上传文档，支持 PDF、Word、Markdown 格式</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(material => (
                <div
                  key={material.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-muted-foreground/20 hover:bg-accent/50 transition-all"
                >
                  <FileText className="h-5 w-5 text-muted-foreground/70 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{material.filename}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', subjectColors[material.subject])}>
                        {material.subject}
                      </span>
                      {material.notebooklmSourceId && (
                        <span className="text-[10px] text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          NotebookLM
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                    {new Date(material.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}
