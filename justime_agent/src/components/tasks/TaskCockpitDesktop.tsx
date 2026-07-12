'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileText, FolderKanban, Search } from 'lucide-react'
import type { TaskProcess } from '@/types/taskProcess'
import type { TaskProcessListQuery } from '@/hooks/useTaskProcesses'
import { cn } from '@/lib/utils'

interface TaskCockpitDesktopProps {
  tasks: TaskProcess[]
  loading?: boolean
  error?: string | null
  query?: TaskProcessListQuery
  total?: number
  totalPages?: number
  onQueryChange?: (updates: Partial<TaskProcessListQuery>) => void
}

const phaseLabels = {
  before: 'Before',
  during: 'During',
  after: 'After',
} as const

function formatHours(value: number) {
  return `${Number(value || 0).toFixed(value % 1 === 0 ? 0 : 1)}h`
}

function getPhaseBuckets(tasks: TaskProcess[]) {
  return {
    before: tasks.filter((task) => task.phase === 'before'),
    during: tasks.filter((task) => task.phase === 'during'),
    after: tasks.filter((task) => task.phase === 'after'),
  }
}

function getSummary(tasks: TaskProcess[]) {
  return {
    active: tasks.filter((task) => task.status === 'active').length,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    totalHours: tasks.reduce((sum, task) => sum + (task.actual_hours || 0), 0),
    evidence: tasks.reduce((sum, task) => sum + (task.evidence_count || 0), 0),
    outputs: tasks.reduce((sum, task) => sum + (task.knowledge_output_count || 0), 0),
  }
}

export function TaskCockpitDesktop({
  tasks,
  loading = false,
  error = null,
  query = {},
  total = tasks.length,
  totalPages = tasks.length ? 1 : 0,
  onQueryChange = () => undefined,
}: TaskCockpitDesktopProps) {
  const buckets = getPhaseBuckets(tasks)
  const summary = getSummary(tasks)
  const currentPage = query.page || 1
  const controlClass = 'h-8 w-full rounded-lg border border-violet-200/60 bg-white/70 px-2.5 text-xs text-[#352b46] outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200/50'

  return (
    <div data-testid="task-cockpit-desktop" className="grid h-full min-h-0 grid-cols-[280px_minmax(0,1fr)_280px] bg-transparent text-[#171421]">
      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-r border-violet-200/40 bg-white/[0.46] p-4 backdrop-blur-2xl">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Query</div>
        <div className="space-y-2.5">
          <label className="relative block">
            <span className="sr-only">搜索任务</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8b7aa8]" />
            <input aria-label="搜索任务" value={query.search || ''} onChange={(event) => onQueryChange({ search: event.target.value })} placeholder="搜索任务" className={cn(controlClass, 'pl-8')} />
          </label>
          <DesktopSelect label="阶段筛选" value={query.phase || ''} onChange={(value) => onQueryChange({ phase: value as TaskProcessListQuery['phase'] })} className={controlClass} options={phaseOptions} />
          <DesktopSelect label="状态筛选" value={query.status || ''} onChange={(value) => onQueryChange({ status: value as TaskProcessListQuery['status'] })} className={controlClass} options={statusOptions} />
          <DesktopSelect label="分类筛选" value={query.category || ''} onChange={(value) => onQueryChange({ category: value as TaskProcessListQuery['category'] })} className={controlClass} options={categoryOptions} />
          <DesktopSelect label="优先级筛选" value={query.priority || ''} onChange={(value) => onQueryChange({ priority: value as TaskProcessListQuery['priority'] })} className={controlClass} options={priorityOptions} />
          <DesktopSelect label="任务排序" value={`${query.sort_by || 'updatedAt'}:${query.sort_order || 'desc'}`} onChange={(value) => {
            const [sortBy, sortOrder] = value.split(':')
            onQueryChange({ sort_by: sortBy as TaskProcessListQuery['sort_by'], sort_order: sortOrder as TaskProcessListQuery['sort_order'] })
          }} className={controlClass} options={sortOptions} />
        </div>
      </aside>

      <main className="desktop-scrollbar min-h-0 overflow-y-auto p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Task Process OS</div>
            <h1 className="mt-1 text-xl font-semibold text-[#171421]">任务驾驶舱</h1>
            <p className="mt-1 text-xs text-[#8b7aa8]">共 {total} 项 · 第 {currentPage} 页</p>
          </div>
          <Link href="/chat" className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/50 bg-white/[0.64] px-3 py-1.5 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/[0.82] hover:text-[#171421]">
            打开 Agent
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {error ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-sm text-rose-700">{error}</div>
        ) : loading ? (
          <div className="rounded-xl border border-violet-200/50 bg-white/60 p-6 text-sm text-[#6d6680]">加载任务中</div>
        ) : tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-violet-200/60 bg-white/50 p-6 text-center text-sm text-[#6d6680]">没有符合当前查询条件的任务。</div>
        ) : (
          <div className="space-y-2.5">
            {tasks.map((task) => (
              <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-xl border border-violet-200/45 bg-white/70 p-4 shadow-[0_14px_42px_rgba(112,77,171,0.07)] backdrop-blur-xl transition hover:border-violet-300/70 hover:bg-white/90">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-[#171421]">{task.title}</p>
                      <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">{phaseLabels[task.phase]}</span>
                      {task.status === 'blocked' ? <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-[#6d6680]">{task.goal}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(task.progress * 100)}%` }} />
                    </div>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-1 text-right text-[11px] text-[#8b7aa8]">
                    <span>{Math.round(task.progress * 100)}%</span>
                    <span>{formatHours(task.actual_hours)}</span>
                    <span>{task.evidence_count} evidence</span>
                    <span>{task.knowledge_output_count} outputs</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="任务分页" className="mt-4 flex items-center justify-between border-t border-violet-200/50 pt-3 text-xs text-[#6d6680]">
            <span>第 {currentPage} / {totalPages} 页</span>
            <div className="flex gap-2">
              <button type="button" aria-label="上一页" disabled={currentPage <= 1} onClick={() => onQueryChange({ page: currentPage - 1 })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200/60 bg-white/60 transition hover:bg-white disabled:opacity-35"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" aria-label="下一页" disabled={currentPage >= totalPages} onClick={() => onQueryChange({ page: currentPage + 1 })} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200/60 bg-white/60 transition hover:bg-white disabled:opacity-35"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </nav>
        ) : null}
      </main>

      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-l border-violet-200/40 bg-[#f7f2ff]/[0.54] p-4 backdrop-blur-2xl">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Metrics</div>
        <div className="grid gap-2">
          {[
            { label: '活跃任务', value: summary.active, icon: FolderKanban },
            { label: '阻塞任务', value: summary.blocked, icon: AlertTriangle },
            { label: '已完成', value: summary.completed, icon: CheckCircle2 },
            { label: '累计投入', value: formatHours(summary.totalHours), icon: Clock3 },
            { label: 'Evidence', value: summary.evidence, icon: FileText },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-violet-200/[0.45] bg-white/[0.64] p-3 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#8b7aa8]">{item.label}</span>
                <item.icon className="h-3.5 w-3.5 text-[#8b7aa8]" />
              </div>
              <div className="mt-2 text-lg font-semibold text-[#171421]">{item.value}</div>
            </div>
          ))}
          <div className="mt-2 rounded-xl border border-violet-200/[0.45] bg-white/[0.64] p-3 shadow-sm backdrop-blur-xl">
            <div className="text-xs text-[#8b7aa8]">当前页阶段分布</div>
            <div className="mt-3 space-y-2 text-xs text-[#5a4c73]">
              {(Object.keys(buckets) as Array<keyof typeof buckets>).map((phase) => (
                <div key={phase} className="flex items-center justify-between">
                  <span>{phaseLabels[phase]}</span>
                  <span className="font-semibold text-[#171421]">{buckets[phase].length}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
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

interface DesktopSelectProps {
  label: string
  value: string
  onChange: (value: string) => void
  className: string
  options: Array<{ value: string; label: string }>
}

function DesktopSelect({ label, value, onChange, className, options }: DesktopSelectProps) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className={className}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  )
}
