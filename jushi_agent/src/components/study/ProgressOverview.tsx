'use client'

import { ProgressStats } from '@/types/study'
import { BookOpen, Clock, Target, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressOverviewProps {
  stats: ProgressStats | null
  loading: boolean
}

interface StatCardProps {
  icon: typeof BookOpen
  label: string
  value: string | number
  unit?: string
  color: string
  bgColor: string
}

function StatCard({ icon: Icon, label, value, unit, color, bgColor }: StatCardProps) {
  return (
    <div className={cn(
      'p-4 rounded-2xl border backdrop-blur-xl',
      'bg-white/5 border-white/10',
      'hover:bg-white/10 transition-all duration-200'
    )}>
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('h-8 w-8 rounded-xl flex items-center justify-center', bgColor)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white">{value}</span>
        {unit && <span className="text-sm text-white/50">{unit}</span>}
      </div>
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  )
}

export function ProgressOverview({ stats, loading }: ProgressOverviewProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  const cards: StatCardProps[] = [
    {
      icon: Target,
      label: '今日完成率',
      value: stats ? Math.round(stats.completionRate * 100) : 0,
      unit: '%',
      color: 'text-emerald-300',
      bgColor: 'bg-emerald-500/20',
    },
    {
      icon: Clock,
      label: '本周学习时长',
      value: stats?.weeklyStudyHours ?? 0,
      unit: 'h',
      color: 'text-blue-300',
      bgColor: 'bg-blue-500/20',
    },
    {
      icon: Flame,
      label: '连续学习天数',
      value: stats?.streakDays ?? 0,
      unit: '天',
      color: 'text-orange-300',
      bgColor: 'bg-orange-500/20',
    },
    {
      icon: BookOpen,
      label: '距考研还有',
      value: stats?.daysUntilExam ?? '-',
      unit: '天',
      color: 'text-rose-300',
      bgColor: 'bg-rose-500/20',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <StatCard key={i} {...card} />
      ))}
    </div>
  )
}
