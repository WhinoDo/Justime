'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileText, FolderKanban } from 'lucide-react'
import type { TaskProcess } from '@/types/taskProcess'
import { cn } from '@/lib/utils'

interface TaskCockpitDesktopProps {
  tasks: TaskProcess[]
  loading?: boolean
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

function getFocusTasks(tasks: TaskProcess[]) {
  return tasks
    .filter((task) => task.status === 'blocked' || task.status === 'active')
    .sort((a, b) => {
      if (a.status === 'blocked' && b.status !== 'blocked') return -1
      if (b.status === 'blocked' && a.status !== 'blocked') return 1
      return b.progress - a.progress
    })
    .slice(0, 8)
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

export function TaskCockpitDesktop({ tasks, loading = false }: TaskCockpitDesktopProps) {
  const buckets = getPhaseBuckets(tasks)
  const focusTasks = getFocusTasks(tasks)
  const summary = getSummary(tasks)

  if (loading) {
    return <div className="p-6 text-sm text-[#6d6680]">加载任务中</div>
  }

  return (
    <div data-testid="task-cockpit-desktop" className="grid h-full min-h-0 grid-cols-[320px_minmax(0,1fr)_320px] bg-transparent text-[#171421]">
      <aside className="desktop-scrollbar min-h-0 overflow-y-auto border-r border-violet-200/40 bg-white/[0.46] p-4 backdrop-blur-2xl">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Focus Queue</div>
        <div className="space-y-2">
          {focusTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-violet-200/60 bg-white/[0.48] p-4 text-sm text-[#6d6680]">暂无需要推进的任务。</div>
          ) : focusTasks.map((task) => (
            <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-xl border border-violet-200/[0.45] bg-white/[0.64] p-3 shadow-[0_14px_42px_rgba(112,77,171,0.08)] backdrop-blur-xl transition hover:border-violet-300/70 hover:bg-white/[0.82]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#171421]">{task.title}</p>
                  <p className="mt-1 text-xs text-[#8b7aa8]">{phaseLabels[task.phase]} · {Math.round(task.progress * 100)}%</p>
                </div>
                {task.status === 'blocked' ? <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" /> : null}
              </div>
            </Link>
          ))}
        </div>
      </aside>

      <main className="desktop-scrollbar min-h-0 overflow-y-auto p-5">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#8b7aa8]">Task Process OS</div>
            <h1 className="mt-1 text-xl font-semibold text-[#171421]">任务驾驶舱</h1>
          </div>
          <Link href="/chat" className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/50 bg-white/[0.64] px-3 py-1.5 text-xs text-[#5a4c73] shadow-sm backdrop-blur-xl hover:bg-white/[0.82] hover:text-[#171421]">
            打开 Agent
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid min-h-[520px] grid-cols-3 gap-3">
          {(Object.keys(buckets) as Array<keyof typeof buckets>).map((phase) => (
            <section key={phase} className={cn(
              'rounded-2xl border border-violet-200/[0.45] shadow-[0_20px_64px_rgba(112,77,171,0.10)] backdrop-blur-2xl',
              phase === 'before' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(239,246,255,0.68))]',
              phase === 'during' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,242,255,0.70))]',
              phase === 'after' && 'bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(236,253,245,0.58))]',
            )}>
              <div className="border-b border-violet-200/[0.35] px-3 py-2">
                <h2 className="text-sm font-semibold text-[#171421]">{phaseLabels[phase]}</h2>
                <p className="text-xs text-[#8b7aa8]">{buckets[phase].length} tasks</p>
              </div>
              <div className="space-y-2 p-3">
                {buckets[phase].slice(0, 8).map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-xl border border-violet-200/40 bg-white/[0.66] p-3 shadow-sm backdrop-blur-xl hover:border-violet-300/70 hover:bg-white/[0.86]">
                    <p className="line-clamp-2 text-sm font-medium text-[#171421]">{task.title}</p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-100">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(task.progress * 100)}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#8b7aa8]">
                      <span>{formatHours(task.actual_hours)}</span>
                      <span>{task.evidence_count} evidence</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
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
        </div>
      </aside>
    </div>
  )
}
