'use client'

import { useState } from 'react'
import { Loader2, NotebookPen, Sparkles, TimerReset } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import type {
  EvidenceCreatePayload,
  GenerateKnowledgePayload,
  KnowledgeFormat,
  TimeLogCreatePayload,
} from '@/types/taskProcess'

export interface TaskDetailActionsProps {
  taskId: string
  onCreateEvidence: (payload: EvidenceCreatePayload) => Promise<{ success: boolean; error?: string }>
  onCreateTimeLog: (payload: TimeLogCreatePayload) => Promise<{ success: boolean; error?: string }>
  onGenerateKnowledge: (payload: GenerateKnowledgePayload) => Promise<{ success: boolean; error?: string }>
}

const knowledgeFormats: { value: KnowledgeFormat; label: string }[] = [
  { value: 'summary', label: '总结' },
  { value: 'tutorial', label: '教程' },
  { value: 'faq', label: 'FAQ' },
  { value: 'review', label: '复盘' },
  { value: 'notes', label: '笔记' },
]

export function TaskDetailActions({ taskId, onCreateEvidence, onCreateTimeLog, onGenerateKnowledge }: TaskDetailActionsProps) {
  const [evidenceTitle, setEvidenceTitle] = useState('')
  const [evidenceContent, setEvidenceContent] = useState('')
  const [hours, setHours] = useState('1')
  const [timeLogNotes, setTimeLogNotes] = useState('')
  const [knowledgeFormat, setKnowledgeFormat] = useState<KnowledgeFormat>('summary')
  const [knowledgeInstructions, setKnowledgeInstructions] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<'evidence' | 'time' | 'knowledge' | null>(null)

  const handleEvidenceSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusyKey('evidence')
    setStatus(null)
    const result = await onCreateEvidence({
      task_id: taskId,
      type: 'note',
      title: evidenceTitle.trim(),
      content: evidenceContent.trim(),
      source: 'task_detail_manual',
    })
    setBusyKey(null)
    if (!result.success) {
      setStatus(result.error || '补写 Evidence 失败')
      return
    }
    setEvidenceTitle('')
    setEvidenceContent('')
    setStatus('Evidence 已补写')
  }

  const handleTimeLogSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusyKey('time')
    setStatus(null)
    const result = await onCreateTimeLog({
      task_id: taskId,
      hours: Number(hours),
      notes: timeLogNotes.trim(),
      date: new Date().toISOString(),
    })
    setBusyKey(null)
    if (!result.success) {
      setStatus(result.error || '记录时间失败')
      return
    }
    setTimeLogNotes('')
    setHours('1')
    setStatus('时间日志已记录')
  }

  const handleKnowledgeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusyKey('knowledge')
    setStatus(null)
    const result = await onGenerateKnowledge({
      task_id: taskId,
      format: knowledgeFormat,
      additional_instructions: knowledgeInstructions.trim(),
    })
    setBusyKey(null)
    if (!result.success) {
      setStatus(result.error || '生成 KnowledgeOutput 失败')
      return
    }
    setKnowledgeInstructions('')
    setStatus('KnowledgeOutput 已生成')
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <JustimeGlassPanel className="rounded-[28px] p-5">
        <div className="mb-4 flex items-center gap-2 text-white">
          <NotebookPen className="h-4 w-4 text-sky-200" />
          <h3 className="text-sm font-semibold">补写 Evidence</h3>
        </div>
        <form className="space-y-3" onSubmit={handleEvidenceSubmit}>
          <Input value={evidenceTitle} onChange={(e) => setEvidenceTitle(e.target.value)} placeholder="标题，例如：定位分页 bug" className="border-white/10 bg-white/5 text-white" />
          <Textarea value={evidenceContent} onChange={(e) => setEvidenceContent(e.target.value)} placeholder="补充这一步做了什么、发现了什么" className="min-h-28 border-white/10 bg-white/5 text-white" />
          <Button type="submit" disabled={busyKey === 'evidence' || !evidenceContent.trim()} className="w-full rounded-2xl bg-sky-200 text-slate-950 hover:bg-sky-100">
            {busyKey === 'evidence' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            写入 Evidence
          </Button>
        </form>
      </JustimeGlassPanel>

      <JustimeGlassPanel className="rounded-[28px] p-5">
        <div className="mb-4 flex items-center gap-2 text-white">
          <TimerReset className="h-4 w-4 text-amber-200" />
          <h3 className="text-sm font-semibold">记录投入时长</h3>
        </div>
        <form className="space-y-3" onSubmit={handleTimeLogSubmit}>
          <Input type="number" min="0.5" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="1" className="border-white/10 bg-white/5 text-white" />
          <Textarea value={timeLogNotes} onChange={(e) => setTimeLogNotes(e.target.value)} placeholder="这段时间具体推进了什么" className="min-h-28 border-white/10 bg-white/5 text-white" />
          <Button type="submit" disabled={busyKey === 'time' || Number(hours) <= 0} className="w-full rounded-2xl bg-amber-200 text-slate-950 hover:bg-amber-100">
            {busyKey === 'time' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            记录时间
          </Button>
        </form>
      </JustimeGlassPanel>

      <JustimeGlassPanel className="rounded-[28px] p-5">
        <div className="mb-4 flex items-center gap-2 text-white">
          <Sparkles className="h-4 w-4 text-emerald-200" />
          <h3 className="text-sm font-semibold">生成 KnowledgeOutput</h3>
        </div>
        <form className="space-y-3" onSubmit={handleKnowledgeSubmit}>
          <Select value={knowledgeFormat} onValueChange={(value) => setKnowledgeFormat(value as KnowledgeFormat)}>
            <SelectTrigger className="border-white/10 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-white/10 bg-slate-900 text-white">
              {knowledgeFormats.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-white hover:bg-white/10 focus:bg-white/10">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea value={knowledgeInstructions} onChange={(e) => setKnowledgeInstructions(e.target.value)} placeholder="例如：强调迁移路径和兼容策略" className="min-h-28 border-white/10 bg-white/5 text-white" />
          <Button type="submit" disabled={busyKey === 'knowledge'} className="w-full rounded-2xl bg-emerald-200 text-slate-950 hover:bg-emerald-100">
            {busyKey === 'knowledge' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            生成产出
          </Button>
        </form>
      </JustimeGlassPanel>

      {status ? <p className="xl:col-span-3 text-sm text-white/70">{status}</p> : null}
    </div>
  )
}
