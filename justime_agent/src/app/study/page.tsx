'use client'

import Link from 'next/link'
import { Suspense, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BookOpenCheck, Clock3, Filter, GraduationCap, Loader2, Search, Sparkles } from 'lucide-react'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { TaskCreateLauncher } from '@/components/tasks/TaskCreateLauncher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useTaskProcesses } from '@/hooks/useTaskProcesses'
import { cn } from '@/lib/utils'
import type { TaskCategory, TaskPhase, TaskProcess, TaskStatus } from '@/types/taskProcess'

const learningCategories: TaskCategory[] = ['learning', 'reading', 'practice', 'research']
const categoryLabels: Record<TaskCategory | 'all', string> = {
  all: '全部学习类',
  learning: '学习',
  reading: '阅读',
  practice: '练习',
  research: '研究',
  development: '开发',
  writing: '写作',
  project: '项目',
  other: '其他',
}

const phaseLabels: Record<TaskPhase | 'all', string> = {
  all: '全部阶段',
  before: 'Before',
  during: 'During',
  after: 'After',
}

const statusLabels: Record<TaskStatus | 'all', string> = {
  all: '全部状态',
  draft: '草稿',
  planned: '已规划',
  active: '推进中',
  paused: '暂停',
  blocked: '阻塞',
  completed: '完成',
  archived: '归档',
}

function normalizeCategory(value: string | null): TaskCategory | 'all' {
  return value && learningCategories.includes(value as TaskCategory) ? value as TaskCategory : 'all'
}

function normalizePhase(value: string | null): TaskPhase | 'all' {
  return value === 'before' || value === 'during' || value === 'after' ? value : 'all'
}

function normalizeStatus(value: string | null): TaskStatus | 'all' {
  return ['draft', 'planned', 'active', 'paused', 'blocked', 'completed', 'archived'].includes(value || '') ? value as TaskStatus : 'all'
}

function formatHours(value: number) {
  return `${Number(value || 0).toFixed(value % 1 === 0 ? 0 : 1)}h`
}

function StudyPageInner() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { tasks, loading, createTask } = useTaskProcesses({ enabled: isAuthenticated, categories: learningCategories })

  const category = normalizeCategory(searchParams.get('category'))
  const phase = normalizePhase(searchParams.get('phase'))
  const status = normalizeStatus(searchParams.get('status'))
  const search = searchParams.get('q') || ''

  const setQuery = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (!value || value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ''}`, { scroll: false })
  }

  const filteredTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (category !== 'all' && task.category !== category) return false
      if (phase !== 'all' && task.phase !== phase) return false
      if (status !== 'all' && task.status !== status) return false
      if (!keyword) return true
      return [task.title, task.goal, task.description, ...task.tags].some((item) => item.toLowerCase().includes(keyword))
    })
  }, [category, phase, search, status, tasks])

  const stats = useMemo(() => {
    const active = filteredTasks.filter((task) => task.status === 'active' || task.status === 'blocked').length
    const completed = filteredTasks.filter((task) => task.status === 'completed').length
    const evidence = filteredTasks.reduce((sum, task) => sum + task.evidence_count, 0)
    const hours = filteredTasks.reduce((sum, task) => sum + task.actual_hours, 0)
    return { active, completed, evidence, hours }
  }, [filteredTasks])

  if (authLoading) return null

  return (
    <JustimePageShell blur="lg" opacity={0.35} contentClassName="px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <JustimeGlassPanel className="overflow-hidden rounded-[36px] p-6 md:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-100/80">
                <GraduationCap className="h-5 w-5 text-emerald-200" />
                <span className="text-xs uppercase tracking-[0.3em]">Study Compatibility Layer</span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold text-white md:text-5xl">学习任务视图</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                这是旧 /study 的收口入口：页面状态保留在 URL，数据统一读取迁移后的 task_processes，并只展示 learning / reading / practice / research 任务。
              </p>
            </div>
            <TaskCreateLauncher
              buttonLabel="新建学习任务"
              createTask={createTask}
              initialCategory="learning"
              buttonProps={{ className: 'rounded-2xl bg-emerald-200 text-slate-950 hover:bg-emerald-100' }}
            />
          </div>
        </JustimeGlassPanel>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: '筛选后任务', value: filteredTasks.length, icon: Filter },
            { label: '推进中', value: stats.active, icon: Sparkles },
            { label: 'Evidence', value: stats.evidence, icon: BookOpenCheck },
            { label: '学习投入', value: formatHours(stats.hours), icon: Clock3 },
          ].map((item) => (
            <JustimeGlassPanel key={item.label} className="rounded-[28px] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                </div>
                <item.icon className="h-5 w-5 text-white/[0.65]" />
              </div>
            </JustimeGlassPanel>
          ))}
        </div>

        <JustimeGlassPanel className="rounded-[32px] p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                value={search}
                onChange={(event) => setQuery('q', event.target.value)}
                placeholder="搜索学习任务、目标或标签"
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/[0.35]"
              />
            </div>
            <Select value={category} onValueChange={(value) => setQuery('category', value)}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                {(['all', ...learningCategories] as const).map((item) => (
                  <SelectItem key={item} value={item} className="text-white hover:bg-white/10 focus:bg-white/10">
                    {categoryLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={phase} onValueChange={(value) => setQuery('phase', value)}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                {(['all', 'before', 'during', 'after'] as const).map((item) => (
                  <SelectItem key={item} value={item} className="text-white hover:bg-white/10 focus:bg-white/10">
                    {phaseLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setQuery('status', value)}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                {(['all', 'draft', 'planned', 'active', 'paused', 'blocked', 'completed', 'archived'] as const).map((item) => (
                  <SelectItem key={item} value={item} className="text-white hover:bg-white/10 focus:bg-white/10">
                    {statusLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </JustimeGlassPanel>

        <JustimeGlassPanel className="rounded-[32px] p-6">
          {loading ? (
            <div className="flex h-52 items-center justify-center text-white/60">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              加载学习任务中
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-white/[0.55]">
              当前筛选下没有学习任务。可以新建一个学习类 TaskProcess，或调整 URL 筛选条件。
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredTasks.map((task) => (
                <StudyTaskCard key={task.id} task={task} />
              ))}
            </div>
          )}
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}

function StudyTaskCard({ task }: { task: TaskProcess }) {
  return (
    <Link href={`/tasks/${task.id}`} className="group block rounded-[28px] border border-white/10 bg-black/10 p-5 transition hover:border-emerald-200/30 hover:bg-emerald-300/10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-200/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-emerald-100">
              {categoryLabels[task.category]}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-white/[0.55]">
              {phaseLabels[task.phase]}
            </span>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-white">{task.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/[0.55]">{task.goal || task.description}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 flex-none text-white/[0.35] transition group-hover:translate-x-1 group-hover:text-emerald-100" />
      </div>
      <div className="mt-5">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/40">
          <span>Progress</span>
          <span>{Math.round(task.progress * 100)}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-200 via-sky-200 to-amber-200" style={{ width: `${Math.round(task.progress * 100)}%` }} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {task.tags.slice(0, 5).map((tag) => (
          <span key={tag} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/[0.55]">#{tag}</span>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-white/[0.55]">
        <div className={cn('rounded-2xl bg-white/5 p-3', task.status === 'blocked' && 'bg-rose-400/10 text-rose-100')}>
          <div className="text-white/[0.35]">Status</div>
          <div className="mt-1 font-medium">{statusLabels[task.status]}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="text-white/[0.35]">Evidence</div>
          <div className="mt-1 font-medium text-white">{task.evidence_count}</div>
        </div>
        <div className="rounded-2xl bg-white/5 p-3">
          <div className="text-white/[0.35]">Hours</div>
          <div className="mt-1 font-medium text-white">{formatHours(task.actual_hours)}</div>
        </div>
      </div>
    </Link>
  )
}

export default function StudyPage() {
  return (
    <Suspense>
      <StudyPageInner />
    </Suspense>
  )
}
