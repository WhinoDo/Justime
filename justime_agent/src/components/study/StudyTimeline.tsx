'use client'

import { PlanPhase, Subject } from '@/types/study'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Clock } from 'lucide-react'

interface StudyTimelineProps {
  phases: PlanPhase[]
  currentPhaseIndex?: number
}

const subjectColors: Record<Subject, string> = {
  '数学': 'bg-blue-500/30 text-blue-200',
  '英语': 'bg-emerald-500/30 text-emerald-200',
  '政治': 'bg-violet-500/30 text-violet-200',
  '专业课': 'bg-purple-500/30 text-purple-200',
}

export function StudyTimeline({ phases, currentPhaseIndex = -1 }: StudyTimelineProps) {
  if (phases.length === 0) {
    return (
      <div className="text-center py-8">
        <Clock className="h-12 w-12 text-white/20 mx-auto mb-3" />
        <p className="text-white/50 text-sm">暂无学习阶段</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {phases.map((phase, index) => {
        const isPast = index < currentPhaseIndex
        const isCurrent = index === currentPhaseIndex
        const isFuture = index > currentPhaseIndex
        const PhaseIcon = isPast ? CheckCircle2 : isCurrent ? Clock : Circle

        return (
          <div key={index} className="relative flex gap-4">
            {index < phases.length - 1 && (
              <div className={cn(
                'absolute left-[11px] top-6 bottom-0 w-0.5',
                isPast ? 'bg-emerald-500/40' : 'bg-white/10'
              )} />
            )}

            <div className="flex-shrink-0 mt-1">
              <PhaseIcon className={cn(
                'h-6 w-6',
                isPast ? 'text-emerald-400' : isCurrent ? 'text-blue-400' : 'text-white/30'
              )} />
            </div>

            <div className={cn(
              'flex-1 p-4 rounded-2xl border mb-3',
              isCurrent
                ? 'bg-blue-500/10 border-blue-400/30'
                : 'bg-white/5 border-white/10'
            )}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={cn(
                  'font-semibold text-sm',
                  isCurrent ? 'text-blue-200' : isPast ? 'text-white/70' : 'text-white/50'
                )}>
                  {phase.phaseName}
                </h4>
                <span className="text-[10px] text-white/30">
                  {phase.startDate} ~ {phase.endDate}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {phase.subjects.map(subject => (
                  <span key={subject} className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full',
                    subjectColors[subject]
                  )}>
                    {subject}
                  </span>
                ))}
              </div>

              {phase.goals.length > 0 && (
                <ul className="space-y-1">
                  {phase.goals.map((goal, gi) => (
                    <li key={gi} className="text-xs text-white/40 flex items-start gap-1.5">
                      <span className="text-white/20 mt-0.5">•</span>
                      {goal}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
