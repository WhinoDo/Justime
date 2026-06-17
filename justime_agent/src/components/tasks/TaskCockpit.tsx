'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight, BookOpenText, CheckCircle2, Clock3, FolderKanban, Loader2, Sparkles } from 'lucide-react'
import type { TaskProcess } from '@/types/taskProcess'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { cn } from '@/lib/utils'
import { TaskCockpitDesktop } from './TaskCockpitDesktop'

interface TaskCockpitProps {
  tasks: TaskProcess[]
  loading?: boolean
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

export function TaskCockpit({ tasks, loading = false, variant = 'immersive' }: TaskCockpitProps) {
  if (variant === 'desktop') {
    return <TaskCockpitDesktop tasks={tasks} loading={loading} />
  }

  const summary = getSummary(tasks)
  const activeTasks = tasks.filter((task) => task.status === 'active' || task.status === 'blocked')
  const archiveTasks = tasks.filter((task) => !activeTasks.includes(task)).slice(0, 6)

  return (
    <div className="space-y-6">
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

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <JustimeGlassPanel className="rounded-[32px] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">当前推进</h2>
              <p className="text-sm text-white/[0.55]">优先关注 active / blocked 任务</p>
            </div>
          </div>

          {loading ? (
            <div className="flex h-48 items-center justify-center text-white/60">
              <Loader2 className="mr-3 h-5 w-5 animate-spin" />
              加载任务中
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-8 text-center text-white/[0.55]">
              暂无活跃任务。可以先创建一个 TaskProcess 开始推进。
            </div>
          ) : (
            <div className="space-y-4">
              {activeTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="block rounded-[28px] border border-white/10 bg-black/10 p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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

                    <div className="w-full max-w-xs space-y-3">
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
        </JustimeGlassPanel>

        <JustimeGlassPanel className="rounded-[32px] p-6">
          <div className="mb-4 flex items-center gap-2">
            <BookOpenText className="h-4 w-4 text-emerald-200" />
            <h2 className="text-lg font-semibold text-white">最近归档</h2>
          </div>
          <div className="space-y-3">
            {archiveTasks.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-white/[0.55]">
                还没有可展示的归档任务。
              </div>
            ) : (
              archiveTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center justify-between rounded-3xl border border-white/10 bg-black/10 px-4 py-4 transition hover:bg-white/[0.06]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{task.title}</p>
                    <p className="mt-1 text-xs text-white/50">{task.phase.toUpperCase()} · {task.knowledge_output_count} outputs</p>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/40" />
                </Link>
              ))
            )}
          </div>
        </JustimeGlassPanel>
      </div>
    </div>
  )
}
