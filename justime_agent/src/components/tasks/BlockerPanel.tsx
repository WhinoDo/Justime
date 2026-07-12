import { AlertTriangle, CheckCircle2, CircleAlert } from 'lucide-react'
import type { Blocker } from '@/types/taskProcess'
import { cn } from '@/lib/utils'

interface BlockerPanelProps {
  blockers: Blocker[]
}

const severityStyles: Record<Blocker['severity'], string> = {
  low: 'border-sky-300/20 bg-sky-300/10 text-sky-100',
  medium: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  high: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
}

const severityLabels: Record<Blocker['severity'], string> = {
  low: '低',
  medium: '中',
  high: '高',
}

export function BlockerPanel({ blockers }: BlockerPanelProps) {
  return (
    <section aria-labelledby="blocker-panel-title" className="space-y-4">
      <div>
        <h3 id="blocker-panel-title" className="text-sm font-semibold text-white">阻塞诊断</h3>
        <p className="mt-1 text-xs text-white/50">来自任务当前的服务端诊断</p>
      </div>

      {blockers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/10 bg-black/10 p-4 text-sm text-white/50">
          当前没有识别到阻塞项。
        </div>
      ) : (
        <div className="space-y-3">
          {blockers.map((blocker) => (
            <article key={blocker.id} className="rounded-lg border border-white/10 bg-black/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn('rounded-md border px-2 py-1 text-xs', severityStyles[blocker.severity])}>
                  严重度：{severityLabels[blocker.severity]}
                </span>
                <span className={cn('inline-flex items-center gap-1.5 text-xs', blocker.resolved ? 'text-emerald-200' : 'text-amber-100')}>
                  {blocker.resolved ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <CircleAlert className="h-4 w-4" aria-hidden="true" />}
                  {blocker.resolved ? '已解决' : '未解决'}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">{blocker.description || '未提供阻塞描述'}</p>
              {blocker.resolved && blocker.resolution ? (
                <div className="mt-3 rounded-md border border-emerald-300/15 bg-emerald-300/5 p-3 text-xs leading-5 text-emerald-100/80">
                  解决说明：{blocker.resolution}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <p className="flex items-start gap-2 text-xs leading-5 text-white/40">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        此区域为只读状态，未提供未经服务端契约支持的解决操作。
      </p>
    </section>
  )
}
