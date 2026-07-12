'use client'

import { useMemo, useState } from 'react'
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
}

function getPlanSummary(aiPlan: TaskProcess['ai_plan']) {
  if (!aiPlan || typeof aiPlan !== 'object') return null
  const summary = aiPlan.summary
  return typeof summary === 'string' && summary.trim() ? summary.trim() : null
}

export function BeforeWorkspace({ task, onUpdatePreparationItems }: BeforeWorkspaceProps) {
  const [pendingItemId, setPendingItemId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
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
          ) : materials.map((material, index) => (
            <article key={`${material.title}-${index}`} className="border-t border-white/10 pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {material.url ? (
                    <a
                      href={material.url}
                      target="_blank"
                      rel="noreferrer"
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
          ))}
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
          ) : milestones.map((milestone) => (
            <article key={milestone.id} className="border-l border-violet-200/25 pl-3">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-medium text-white">{milestone.title}</h4>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-violet-100/60">
                  {milestone.status === 'completed' ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                  {milestone.status}
                </span>
              </div>
              {milestone.description ? <p className="mt-1 text-sm leading-5 text-white/50">{milestone.description}</p> : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
