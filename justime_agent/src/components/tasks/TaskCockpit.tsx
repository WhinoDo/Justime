'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FolderKanban, Loader2, Search, Sparkles } from 'lucide-react'
import type { TaskProcess } from '@/types/taskProcess'
import type { TaskProcessListQuery } from '@/hooks/useTaskProcesses'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { cn } from '@/lib/utils'
import { TaskCockpitDesktop } from './TaskCockpitDesktop'

export interface TaskCockpitProps {
  tasks: TaskProcess[]
  loading?: boolean
  error?: string | null
  query?: TaskProcessListQuery
  total?: number
  totalPages?: number
  onQueryChange?: (updates: Partial<TaskProcessListQuery>) => void
  variant?: 'immersive' | 'desktop'
}

const phaseLabels = {
  before: 'Before',
  during: 'During',
  after: 'After',
} as const

const phaseTone = {
  before: 'text-sky-100 bg-sky-400/[0.15] border-sky-300/20',
  during: 'text-amber-100 bg-amber-400/[0.15] border-amber-300/20',
  after: 'text-emerald-100 bg-emerald-400/[0.15] border-emerald-300/20',
} as const

function formatHours(value: number) {
  return `${Number(value || 0).toFixed(value % 1 === 0 ? 0 : 1)}h`
}

function getSummary(tasks: TaskProcess[]) {
  const active = tasks.filter((task) => task.status === 'active').length
  const blocked = tasks.filter((task) => task.status === 'blocked').length
  const completed = tasks.filter((task) => task.status === 'completed').length
  const totalHours = tasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0)
  return { active, blocked, completed, totalHours }
}

export function TaskCockpit({
  tasks,
  loading = false,
  error = null,
  query = {},
  total = tasks.length,
  totalPages = tasks.length ? 1 : 0,
  onQueryChange = () => undefined,
  variant = 'immersive',
}: TaskCockpitProps) {
  if (variant === 'desktop') {
    return (
      <TaskCockpitDesktop
        tasks={tasks}
        loading={loading}
        error={error}
        query={query}
        total={total}
        totalPages={totalPages}
        onQueryChange={onQueryChange}
      />
    )
  }

  const summary = getSummary(tasks)
  const currentPage = query.page || 1
  const controlClass = 'h-10 rounded-xl border border-white/[0.12] bg-black/20 px-3 text-sm text-white outline-none transition focus:border-white/30 focus:ring-2 focus:ring-white/10'

  return (
    <div className="space-y-6">
      <JustimeGlassPanel className="rounded-[24px] p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1.5fr)_repeat(5,minmax(120px,1fr))]">
          <label className="relative sm:col-span-2 xl:col-span-1">
            <span className="sr-only">搜索任务</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
            <input
              aria-label="搜索任务"
              value={query.search || ''}
              onChange={(event) => onQueryChange({ search: event.target.value })}
              placeholder="搜索标题、目标或描述"
              className={cn(controlClass, 'w-full pl-9')}
            />
          </label>
          <TaskSelect label="阶段筛选" value={query.phase || ''} onChange={(value) => onQueryChange({ phase: value as TaskProcessListQuery['phase'] })} className={controlClass} options={phaseOptions} />
          <TaskSelect label="状态筛选" value={query.status || ''} onChange={(value) => onQueryChange({ status: value as TaskProcessListQuery['status'] })} className={controlClass} options={statusOptions} />
          <TaskSelect label="分类筛选" value={query.category || ''} onChange={(value) => onQueryChange({ category: value as TaskProcessListQuery['category'] })} className={controlClass} options={categoryOptions} />
          <TaskSelect label="优先级筛选" value={query.priority || ''} onChange={(value) => onQueryChange({ priority: value as TaskProcessListQuery['priority'] })} className={controlClass} options={priorityOptions} />
          <TaskSelect label="任务排序" value={`${query.sort_by || 'updatedAt'}:${query.sort_order || 'desc'}`} onChange={(value) => {
            const [sortBy, sortOrder] = value.split(':')
            onQueryChange({ sort_by: sortBy as TaskProcessListQuery['sort_by'], sort_order: sortOrder as TaskProcessListQuery['sort_order'] })
          }} className={controlClass} options={sortOptions} />
        </div>
      </JustimeGlassPanel>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: '活跃任务', value: summary.active, icon: FolderKanban },
          { label: '阻塞任务', value: summary.blocked, icon: AlertTriangle },
          { label: '已完成', value: summary.completed, icon: CheckCircle2 },
          { label: '累计投入', value: formatHours(summary.totalHours), icon: Clock3 },
        ].map((item) => (
          <JustimeGlassPanel key={item.label} className="rounded-[28px] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/[0.45]">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white/80">
                <item.icon className="h-5 w-5" />
              </div>
            </div>
          </JustimeGlassPanel>
        ))}
      </div>

      <JustimeGlassPanel className="rounded-[32px] p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-white/70">
              <Sparkles className="h-4 w-4 text-amber-200" />
              <span className="text-xs uppercase tracking-[0.28em]">Task Process OS</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-white md:text-4xl">任务驾驶舱</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
              任务不再只是待办列表。这里按 Before / During / After 跟踪任务进程、证据沉淀和知识产出。
            </p>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.15] bg-white/10 px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.15] hover:text-white"
          >
            打开通用对话
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </JustimeGlassPanel>

      <JustimeGlassPanel className="rounded-[32px] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">查询结果</h2>
              <p className="text-sm text-white/[0.55]">共 {total} 项，当前第 {currentPage} 页</p>
            </div>
          </div>

          {error ? (
            <div role="alert" className="rounded-3xl border border-rose-300/20 bg-rose-400/10 p-6 text-sm text-rose-100">{error}</div>
          ) : loading ? (
            <div className="flex h-48 items-center justify-center text-white/60">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              加载任务中
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-white/[0.55]">
              没有符合当前查询条件的任务。
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {tasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-[28px] border border-white/10 bg-black/10 p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
                  <div className="flex h-full flex-col gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-white">{task.title}</h3>
                        <span className={cn('rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]', phaseTone[task.phase])}>
                          {phaseLabels[task.phase]}
                        </span>
                        {task.status === 'blocked' ? (
                          <span className="rounded-full border border-rose-300/20 bg-rose-400/[0.15] px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-rose-100">Blocked</span>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/60">{task.goal}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {task.tags.slice(0, 4).map((tag) => (
                          <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/[0.65]">#{tag}</span>
                        ))}
                      </div>
                    </div>

                    <div className="mt-auto w-full space-y-3">
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-white/[0.45]">
                        <span>Progress</span>
                        <span>{Math.round(task.progress * 100)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-300 via-amber-200 to-emerald-300" style={{ width: `${Math.round(task.progress * 100)}%` }} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs text-white/60">
                        <div className="rounded-2xl bg-white/5 p-3">
                          <div className="text-white/[0.35]">Evidence</div>
                          <div className="mt-1 text-sm font-semibold text-white">{task.evidence_count}</div>
                        </div>
                        <div className="rounded-2xl bg-white/5 p-3">
                          <div className="text-white/[0.35]">Hours</div>
                          <div className="mt-1 text-sm font-semibold text-white">{formatHours(task.actual_hours)}</div>
                        </div>
                        <div className="rounded-2xl bg-white/5 p-3">
                          <div className="text-white/[0.35]">Outputs</div>
                          <div className="mt-1 text-sm font-semibold text-white">{task.knowledge_output_count}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={total}
            onPageChange={(page) => onQueryChange({ page })}
          />
      </JustimeGlassPanel>
    </div>
  )
}

const phaseOptions = [
  { value: '', label: '全部阶段' },
  { value: 'before', label: 'Before' },
  { value: 'during', label: 'During' },
  { value: 'after', label: 'After' },
]

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'planned', label: '已规划' },
  { value: 'active', label: '进行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'blocked', label: '阻塞' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
]

const categoryOptions = [
  { value: '', label: '全部分类' },
  { value: 'learning', label: '学习' },
  { value: 'development', label: '开发' },
  { value: 'writing', label: '写作' },
  { value: 'research', label: '研究' },
  { value: 'reading', label: '阅读' },
  { value: 'project', label: '项目' },
  { value: 'practice', label: '练习' },
  { value: 'other', label: '其他' },
]

const priorityOptions = [
  { value: '', label: '全部优先级' },
  { value: 'critical', label: '紧急' },
  { value: 'high', label: '高' },
  { value: 'medium', label: '中' },
  { value: 'low', label: '低' },
]

const sortOptions = [
  { value: 'updatedAt:desc', label: '最近更新' },
  { value: 'updatedAt:asc', label: '最早更新' },
  { value: 'createdAt:desc', label: '最近创建' },
  { value: 'deadline:asc', label: '截止时间' },
  { value: 'priority:desc', label: '优先级' },
  { value: 'progress:desc', label: '进度从高到低' },
  { value: 'progress:asc', label: '进度从低到高' },
]

interface TaskSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  className: string
  options: Array<{ value: string; label: string }>
}

export function TaskSelect({ label, value, onChange, className, options }: TaskSelectProps) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={className}>
      {options.map((option) => <option key={option.value} value={option.value} className="text-slate-950">{option.label}</option>)}
    </select>
  )
}

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  className?: string
  tone?: 'light' | 'dark'
}

export function Pagination({ page, totalPages, total, onPageChange, className, tone = 'dark' }: PaginationProps) {
  if (totalPages <= 1) return null
  const isLight = tone === 'light'
  return (
    <nav aria-label="任务分页" className={cn('mt-5 flex items-center justify-between gap-3 border-t pt-4', isLight ? 'border-violet-200/50 text-[#5a4c73]' : 'border-white/10 text-white/65', className)}>
      <span className="text-xs">共 {total} 项 · 第 {page} / {totalPages} 页</span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="上一页" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-35', isLight ? 'border-violet-200/60 bg-white/60 hover:bg-white' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" aria-label="下一页" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition disabled:opacity-35', isLight ? 'border-violet-200/60 bg-white/60 hover:bg-white' : 'border-white/10 bg-white/5 hover:bg-white/10')}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </nav>
  )
}
