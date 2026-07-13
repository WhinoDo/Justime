'use client'

import { createContext, useContext, useMemo, useRef, useState } from 'react'
import { BookOpen, CheckCircle2, CircleDot, ExternalLink, ListChecks, Loader2, Sparkles } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import type { PreparationItem, TaskProcess } from '@/types/taskProcess'
import { cn } from '@/lib/utils'

interface UpdateResult {
  success: boolean
  error?: string
}

interface BeforeWorkspaceProps {
  task: TaskProcess
  onUpdatePreparationItems: (items: PreparationItem[]) => Promise<UpdateResult>
  onUpdateMilestoneStatus?: UpdateMilestoneStatus
}

type MilestoneStatus = TaskProcess['milestones'][number]['status']
type UpdateMilestoneStatus = (milestoneId: string, status: MilestoneStatus) => Promise<UpdateResult>

const MILESTONE_STATUS_OPTIONS: Array<{ value: MilestoneStatus; label: string }> = [
  { value: 'pending', label: '待开始' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'skipped', label: '已跳过' },
]

const MilestoneStatusContext = createContext<UpdateMilestoneStatus | null>(null)

export function BeforeWorkspaceMilestoneProvider({
  children,
  onUpdateMilestoneStatus,
}: {
  children: React.ReactNode
  onUpdateMilestoneStatus: UpdateMilestoneStatus
}) {
  return (
    <MilestoneStatusContext.Provider value={onUpdateMilestoneStatus}>
      {children}
    </MilestoneStatusContext.Provider>
  )
}

function getPlanSummary(aiPlan: TaskProcess['ai_plan']) {
  if (!aiPlan || typeof aiPlan !== 'object') return null
  const summary = aiPlan.summary
  return typeof summary === 'string' && summary.trim() ? summary.trim() : null
}

function getSafeMaterialUrl(value?: string | null) {
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

export function BeforeWorkspace({
  task,
  onUpdatePreparationItems,
  onUpdateMilestoneStatus: onUpdateMilestoneStatusProp,
}: BeforeWorkspaceProps) {
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingMilestoneIds, setPendingMilestoneIds] = useState<string[]>([])
  const [milestoneErrors, setMilestoneErrors] = useState<Record<string, string>>({})
  const pendingMilestoneIdsRef = useRef(new Set<string>())
  const contextUpdateMilestoneStatus = useContext(MilestoneStatusContext)
  const onUpdateMilestoneStatus = onUpdateMilestoneStatusProp || contextUpdateMilestoneStatus
  const planSummary = getPlanSummary(task.ai_plan)
  const materials = task.materials || []
  const sourcePreparationItems = task.preparation_items || []
  const preparationItems = [...sourcePreparationItems].sort((a, b) => a.order - b.order)
  const milestones = useMemo(
    () => [...task.milestones].sort((a, b) => a.order - b.order),
    [task.milestones],
  )

  const handlePreparationChange = async (itemId: string, done: boolean) => {
    if (pendingItemId) return

    setPendingItemId(itemId)
    setError(null)
    const nextItems = sourcePreparationItems.map((item) => (
      item.id === itemId ? { ...item, done } : item
    ))

    try {
      const result = await onUpdatePreparationItems(nextItems)
      if (!result.success) {
        setError(result.error || '准备项更新失败，请稍后重试。')
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '准备项更新失败，请稍后重试。')
    } finally {
      setPendingItemId(null)
    }
  }

  const handleMilestoneStatusChange = async (milestoneId: string, status: MilestoneStatus) => {
    const milestone = task.milestones.find((item) => item.id === milestoneId)
    if (!onUpdateMilestoneStatus || !milestone || milestone.status === status || pendingMilestoneIdsRef.current.has(milestoneId)) {
      return
    }

    pendingMilestoneIdsRef.current.add(milestoneId)
    setPendingMilestoneIds((current) => [...current, milestoneId])
    setMilestoneErrors((current) => {
      const next = { ...current }
      delete next[milestoneId]
      return next
    })

    try {
      const result = await onUpdateMilestoneStatus(milestoneId, status)
      if (!result.success) {
        setMilestoneErrors((current) => ({
          ...current,
          [milestoneId]: result.error || '里程碑更新失败，请稍后重试。',
        }))
      }
    } catch (updateError) {
      setMilestoneErrors((current) => ({
        ...current,
        [milestoneId]: updateError instanceof Error ? updateError.message : '里程碑更新失败，请稍后重试。',
      }))
    } finally {
      pendingMilestoneIdsRef.current.delete(milestoneId)
      setPendingMilestoneIds((current) => current.filter((id) => id !== milestoneId))
    }
  }

  return (
    <div className="space-y-5" data-testid="before-workspace">
      {planSummary ? (
        <section aria-labelledby="before-plan-heading" className="border-l-2 border-amber-300/70 pl-4">
          <div className="flex items-center gap-2 text-amber-100/80">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <h3 id="before-plan-heading" className="text-xs font-semibold uppercase">AI 计划</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-white/70">{planSummary}</p>
        </section>
      ) : null}

      <section aria-labelledby="before-materials-heading">
        <div className="flex items-center gap-2 text-white/75">
          <BookOpen className="h-4 w-4 text-sky-200" aria-hidden="true" />
          <h3 id="before-materials-heading" className="text-sm font-semibold">学习资料</h3>
          <span className="text-xs text-white/40">{materials.length}</span>
        </div>
        <div className="mt-3 space-y-2">
          {materials.length === 0 ? (
            <p className="text-sm text-white/45">暂无学习资料。</p>
          ) : materials.map((material, index) => {
            const safeUrl = getSafeMaterialUrl(material.url)
            return (
              <article key={`${material.title}-${index}`} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {safeUrl ? (
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-sky-100 underline decoration-sky-200/30 underline-offset-4 hover:decoration-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200/70"
                      >
                        <span className="truncate">{material.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      </a>
                    ) : (
                      <h4 className="text-sm font-medium text-white">{material.title}</h4>
                    )}
                    <p className="mt-1 text-sm leading-5 text-white/55">{material.summary}</p>
                  </div>
                  <span className="shrink-0 text-xs text-white/35">{material.source}</span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="before-preparation-heading">
        <div className="flex items-center gap-2 text-white/75">
          <ListChecks className="h-4 w-4 text-emerald-200" aria-hidden="true" />
          <h3 id="before-preparation-heading" className="text-sm font-semibold">准备清单</h3>
          <span className="text-xs text-white/40">
            {sourcePreparationItems.filter((item) => item.done).length}/{sourcePreparationItems.length}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {preparationItems.length === 0 ? (
            <p className="text-sm text-white/45">暂无准备项。</p>
          ) : preparationItems.map((item) => {
            const pending = pendingItemId === item.id
            return (
              <label
                key={item.id}
                className={cn(
                  'flex min-h-10 items-center gap-3 border-t border-white/10 pt-2 first:border-t-0 first:pt-0',
                  pendingItemId && 'cursor-wait',
                )}
              >
                <Checkbox
                  checked={item.done}
                  disabled={Boolean(pendingItemId)}
                  onCheckedChange={(checked) => handlePreparationChange(item.id, checked === true)}
                  aria-label={item.title}
                  className="border-white/40 data-[state=checked]:border-emerald-300 data-[state=checked]:bg-emerald-300 data-[state=checked]:text-emerald-950"
                />
                <span className={cn('flex-1 text-sm text-white/70', item.done && 'text-white/40 line-through')}>
                  {item.title}
                </span>
                {pending ? <Loader2 className="h-4 w-4 animate-spin text-emerald-200" aria-hidden="true" /> : null}
              </label>
            )
          })}
        </div>
        {pendingItemId ? <p role="status" className="mt-2 text-xs text-white/45">正在保存准备项...</p> : null}
        {error ? <p role="alert" className="mt-2 text-sm text-rose-200">{error}</p> : null}
      </section>

      <section aria-labelledby="before-milestones-heading">
        <div className="flex items-center gap-2 text-white/75">
          <CircleDot className="h-4 w-4 text-violet-200" aria-hidden="true" />
          <h3 id="before-milestones-heading" className="text-sm font-semibold">里程碑</h3>
          <span className="text-xs text-white/40">{milestones.length}</span>
        </div>
        <div className="mt-3 space-y-3">
          {milestones.length === 0 ? (
            <p className="text-sm text-white/45">暂无里程碑。</p>
          ) : milestones.map((milestone) => {
            const pending = pendingMilestoneIds.includes(milestone.id)
            const milestoneError = milestoneErrors[milestone.id]
            const errorId = `milestone-${milestone.id}-error`

            return (
              <article key={milestone.id} className="border-l border-violet-200/25 pl-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-medium text-white">{milestone.title}</h4>
                    {milestone.description ? <p className="mt-1 text-sm leading-5 text-white/50">{milestone.description}</p> : null}
                    {milestone.completed_at ? (
                      <time dateTime={milestone.completed_at} className="mt-1 block text-xs text-white/40">
                        完成于 {new Date(milestone.completed_at).toLocaleString('zh-CN')}
                      </time>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin text-violet-200" aria-hidden="true" /> : null}
                    {milestone.status === 'completed' && !pending ? <CheckCircle2 className="h-4 w-4 text-emerald-200" aria-hidden="true" /> : null}
                    <select
                      value={milestone.status}
                      disabled={pending || !onUpdateMilestoneStatus}
                      onChange={(event) => handleMilestoneStatusChange(milestone.id, event.target.value as MilestoneStatus)}
                      aria-label={`${milestone.title}状态`}
                      aria-describedby={milestoneError ? errorId : undefined}
                      className="h-8 min-w-24 rounded border border-white/15 bg-black/20 px-2 text-xs text-violet-100 outline-none focus-visible:ring-2 focus-visible:ring-violet-200/70 disabled:cursor-wait disabled:opacity-60"
                    >
                      {MILESTONE_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value} className="bg-slate-950 text-white">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {pending ? <p role="status" className="mt-2 text-xs text-white/45">正在保存里程碑...</p> : null}
                {milestoneError ? <p id={errorId} role="alert" className="mt-2 text-sm text-rose-200">{milestoneError}</p> : null}
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
