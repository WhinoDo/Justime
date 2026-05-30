'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { JushiPageShell } from '@/components/layout/JushiPageShell'
import { JushiGlassPanel } from '@/components/layout/JushiGlassPanel'
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
  '政治': 'bg-amber-500/20 text-amber-200 border-amber-400/30',
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
      const res = await fetch(API_ENDPOINTS.STUDY.PROFILE.replace('/profile', '/materials'))
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
      const res = await fetch(API_ENDPOINTS.STUDY.PROFILE.replace('/profile', '/materials'), {
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
      <JushiPageShell blur="xl" contentClassName="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </JushiPageShell>
    )
  }

  if (!isAuthenticated || !user) return null

  return (
    <JushiPageShell fullHeight blur="lg" opacity={0.4} contentClassName="h-full overflow-y-auto">
      <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-4 pb-8">
        <div className="flex items-center justify-between bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <Link href="/study">
              <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-emerald-300" />
                学习资料
              </h1>
              <p className="text-xs text-white/50 mt-0.5">{materials.length} 份资料</p>
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
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-lg shadow-emerald-500/20 cursor-pointer"
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
                  ? 'bg-white/15 border-white/30 text-white'
                  : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
              )}
            >
              {s === 'all' ? '全部' : s}
            </button>
          ))}
        </div>

        <JushiGlassPanel className="rounded-2xl p-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-white/10 mx-auto mb-4" />
              <p className="text-white/50 text-sm mb-1">暂无学习资料</p>
              <p className="text-white/30 text-xs">上传文档，支持 PDF、Word、Markdown 格式</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(material => (
                <div
                  key={material.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                >
                  <FileText className="h-5 w-5 text-white/40 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{material.filename}</p>
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
                  <span className="text-[10px] text-white/30 flex-shrink-0">
                    {new Date(material.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </JushiGlassPanel>
      </div>
    </JushiPageShell>
  )
}
