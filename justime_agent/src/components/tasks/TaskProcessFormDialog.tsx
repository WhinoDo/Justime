'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  TaskCategory,
  TaskPriority,
  TaskProcess,
  TaskProcessCreatePayload,
  TaskProcessUpdatePayload,
} from '@/types/taskProcess'

interface TaskProcessFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  task?: TaskProcess | null
  initialCategory?: TaskCategory
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: TaskProcessCreatePayload | TaskProcessUpdatePayload) => Promise<{ success: boolean; error?: string }>
}

interface FormState {
  title: string
  description: string
  goal: string
  category: TaskCategory
  priority: TaskPriority
  tags: string
  estimated_hours: string
  deadline: string
}

const categoryOptions: { value: TaskCategory; label: string }[] = [
  { value: 'learning', label: '学习' },
  { value: 'development', label: '开发' },
  { value: 'writing', label: '写作' },
  { value: 'research', label: '研究' },
  { value: 'reading', label: '阅读' },
  { value: 'project', label: '项目' },
  { value: 'practice', label: '练习' },
  { value: 'other', label: '其他' },
]

const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '关键' },
]

function toFormState(task?: TaskProcess | null, initialCategory: TaskCategory = 'other'): FormState {
  return {
    title: task?.title || '',
    description: task?.description || '',
    goal: task?.goal || '',
    category: task?.category || initialCategory,
    priority: task?.priority || 'medium',
    tags: (task?.tags || []).join(', '),
    estimated_hours: task?.estimated_hours != null ? String(task.estimated_hours) : '',
    deadline: task?.deadline ? String(task.deadline).slice(0, 10) : '',
  }
}

export function TaskProcessFormDialog({
  open,
  mode,
  task,
  initialCategory = 'other',
  onOpenChange,
  onSubmit,
}: TaskProcessFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(task, initialCategory))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(toFormState(task, initialCategory))
      setError(null)
      setSubmitting(false)
    }
  }, [open, task, initialCategory])

  const title = useMemo(() => (mode === 'create' ? '创建任务' : '编辑任务'), [mode])

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const tags = form.tags
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      goal: form.goal.trim(),
      category: form.category,
      priority: form.priority,
      tags,
      estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : null,
      deadline: form.deadline || null,
      ...(mode === 'create' ? { auto_plan: true } : {}),
    }

    const result = await onSubmit(payload)
    setSubmitting(false)
    if (!result.success) {
      setError(result.error || '保存失败')
      return
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[28px] border border-white/10 bg-slate-950/95 p-0 text-white shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">{title}</DialogTitle>
            <DialogDescription className="text-white/[0.55]">
              直接维护 TaskProcess 主数据，不再依赖 chat 间接创建。
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-white/70" htmlFor="task-title">标题</label>
              <Input id="task-title" value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="例如：整理 FastAPI 任务流改造" className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-white/70" htmlFor="task-goal">目标</label>
              <Textarea id="task-goal" value={form.goal} onChange={(e) => updateField('goal', e.target.value)} placeholder="描述最终希望达成的结果" className="min-h-24 border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-white/70" htmlFor="task-description">说明</label>
              <Textarea id="task-description" value={form.description} onChange={(e) => updateField('description', e.target.value)} placeholder="补充背景、范围或约束" className="min-h-24 border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">分类</label>
              <Select value={form.category} onValueChange={(value) => updateField('category', value as TaskCategory)}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-white">
                  {categoryOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-white hover:bg-white/10 focus:bg-white/10">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70">优先级</label>
              <Select value={form.priority} onValueChange={(value) => updateField('priority', value as TaskPriority)}>
                <SelectTrigger className="border-white/10 bg-white/5 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-slate-900 text-white">
                  {priorityOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-white hover:bg-white/10 focus:bg-white/10">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70" htmlFor="task-hours">预估时长</label>
              <Input id="task-hours" type="number" min="0" step="0.5" value={form.estimated_hours} onChange={(e) => updateField('estimated_hours', e.target.value)} placeholder="4" className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-white/70" htmlFor="task-deadline">截止日期</label>
              <Input id="task-deadline" type="date" value={form.deadline} onChange={(e) => updateField('deadline', e.target.value)} className="border-white/10 bg-white/5 text-white" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-white/70" htmlFor="task-tags">标签</label>
              <Input id="task-tags" value={form.tags} onChange={(e) => updateField('tags', e.target.value)} placeholder="study, migration, frontend" className="border-white/10 bg-white/5 text-white" />
            </div>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          <DialogFooter className="gap-3 sm:justify-end sm:space-x-0">
            <Button type="button" variant="ghost" className="text-white/70 hover:bg-white/10 hover:text-white" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={submitting} className="rounded-2xl bg-white text-slate-950 hover:bg-white/90">
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? '创建任务' : '保存修改'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
