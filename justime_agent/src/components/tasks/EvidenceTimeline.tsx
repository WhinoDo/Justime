'use client'

import { useMemo } from 'react'
import { CalendarDays, ChevronDown, Clock3, FileText, Flag, Link2 } from 'lucide-react'
import type { Evidence } from '@/types/taskProcess'

interface EvidenceTimelineProps {
  evidence: Evidence[]
}

interface EvidenceGroup {
  dateKey: string
  dateLabel: string
  items: Evidence[]
}

const dateLabelFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
})

function getEvidenceTimestamp(item: Evidence) {
  if (!item.createdAt) return Number.NEGATIVE_INFINITY
  const timestamp = new Date(item.createdAt).getTime()
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp
}

function getLocalDateKey(timestamp: number) {
  if (!Number.isFinite(timestamp)) return 'unknown'
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function groupEvidence(evidence: Evidence[]): EvidenceGroup[] {
  const sorted = [...evidence].sort((left, right) => getEvidenceTimestamp(right) - getEvidenceTimestamp(left))
  const groups = new Map<string, EvidenceGroup>()

  sorted.forEach((item) => {
    const timestamp = getEvidenceTimestamp(item)
    const dateKey = getLocalDateKey(timestamp)
    const existingGroup = groups.get(dateKey)

    if (existingGroup) {
      existingGroup.items.push(item)
      return
    }

    groups.set(dateKey, {
      dateKey,
      dateLabel: dateKey === 'unknown' ? '日期未记录' : dateLabelFormatter.format(new Date(timestamp)),
      items: [item],
    })
  })

  return Array.from(groups.values())
}

export function EvidenceTimeline({ evidence }: EvidenceTimelineProps) {
  const groups = useMemo(() => groupEvidence(evidence), [evidence])

  return (
    <section aria-labelledby="evidence-timeline-title" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id="evidence-timeline-title" className="text-sm font-semibold text-white">Evidence 时间线</h3>
          <p className="mt-1 text-xs text-white/50">按本地日期和记录时间倒序排列</p>
        </div>
        <span className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">
          {evidence.length} 条
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/10 p-4 text-sm text-white/50">
          还没有 Evidence。
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.dateKey} data-testid="evidence-date-group" data-date-key={group.dateKey} className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-white/60">
                <CalendarDays className="h-4 w-4 text-sky-200" aria-hidden="true" />
                <span>{group.dateLabel}</span>
                <span className="text-white/35">{group.items.length} 条</span>
              </div>

              <div className="space-y-3 border-l border-white/10 pl-4">
                {group.items.map((item) => {
                  const timestamp = getEvidenceTimestamp(item)
                  const timeLabel = Number.isFinite(timestamp) ? timeFormatter.format(new Date(timestamp)) : '时间未记录'

                  return (
                    <article key={item.id} data-testid="evidence-item" data-evidence-id={item.id} className="rounded-lg border border-white/10 bg-black/10 p-4">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                        <span className="rounded-md bg-sky-300/10 px-2 py-1 text-sky-100">{item.type || '类型未记录'}</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                          {timeLabel}
                        </span>
                      </div>

                      <h4 className="mt-3 text-sm font-medium text-white">{item.title || '未命名 Evidence'}</h4>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/60">{item.content || '未提供内容'}</p>

                      <div className="mt-3 grid gap-2 text-xs text-white/45 sm:grid-cols-2">
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">来源：{item.source || '未记录'}</span>
                        </span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <Flag className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span className="truncate">里程碑：{item.milestone_id || '未关联'}</span>
                        </span>
                      </div>

                      <details className="mt-3 border-t border-white/10 pt-3 text-xs text-white/55">
                        <summary className="flex cursor-pointer list-none items-center gap-2 text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50">
                          <ChevronDown className="h-4 w-4" aria-hidden="true" />
                          展开只读详情
                        </summary>
                        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div>
                            <dt className="text-white/40">Evidence ID</dt>
                            <dd className="mt-1 break-all text-white/65">{item.id}</dd>
                          </div>
                          <div>
                            <dt className="text-white/40">AI 提取</dt>
                            <dd className="mt-1 text-white/65">{item.ai_extracted ? '是' : '否'}</dd>
                          </div>
                          <div>
                            <dt className="text-white/40">情绪</dt>
                            <dd className="mt-1 text-white/65">{item.sentiment || '未记录'}</dd>
                          </div>
                          <div>
                            <dt className="text-white/40">置信度</dt>
                            <dd className="mt-1 text-white/65">{Number.isFinite(item.confidence) ? item.confidence : '未记录'}</dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="inline-flex items-center gap-1.5 text-white/40">
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                              元数据
                            </dt>
                            <dd className="mt-1 whitespace-pre-wrap break-words text-white/65">
                              {item.metadata && Object.keys(item.metadata).length > 0
                                ? JSON.stringify(item.metadata, null, 2)
                                : '未记录'}
                            </dd>
                          </div>
                        </dl>
                      </details>
                    </article>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
