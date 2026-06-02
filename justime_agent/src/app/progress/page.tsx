'use client'

import { useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStudyProgress, useProgressStats } from '@/hooks/useProgress'
import { useStudyProfile } from '@/hooks/useStudyPlan'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, BarChart3, Flame, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import dayjs from 'dayjs'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { Subject } from '@/types/study'

const SUBJECT_COLORS: Record<string, string> = {
  '数学': '#3b82f6',
  '英语': '#10b981',
  '政治': '#f59e0b',
  '专业课': '#8b5cf6',
}

export default function ProgressPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { profile } = useStudyProfile()

  const endDate = dayjs().format('YYYY-MM-DD')
  const startDate = dayjs().subtract(30, 'day').format('YYYY-MM-DD')
  const { progress, loading: progressLoading } = useStudyProgress(startDate, endDate)
  const { stats, loading: statsLoading } = useProgressStats()

  const dailyChartData = useMemo(() => {
    const dayMap = new Map<string, { date: string; hours: number }>()
    for (let i = 29; i >= 0; i--) {
      const d = dayjs().subtract(i, 'day').format('MM-DD')
      dayMap.set(d, { date: d, hours: 0 })
    }
    for (const p of progress) {
      const d = dayjs(p.date).format('MM-DD')
      if (dayMap.has(d)) {
        dayMap.get(d)!.hours += p.actualHours
      }
    }
    return Array.from(dayMap.values())
  }, [progress])

  const subjectPieData = useMemo(() => {
    if (!stats?.subjectBreakdown) return []
    return (Object.entries(stats.subjectBreakdown) as [Subject, number][])
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }))
  }, [stats])

  if (authLoading) {
    return (
      <JustimePageShell blur="xl" contentClassName="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </JustimePageShell>
    )
  }

  if (!isAuthenticated || !user) return null

  return (
    <JustimePageShell fullHeight blur="lg" opacity={0.4} contentClassName="h-full overflow-y-auto">
      <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-4 pb-8">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <Link href="/study">
              <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-300" />
                进度统计
              </h1>
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 text-sm bg-white/5 sm:bg-transparent p-2 sm:p-0 rounded-xl border border-white/5 sm:border-0">
            {stats?.streakDays != null && (
              <div className="flex items-center gap-1.5 text-orange-300">
                <Flame className="h-4 w-4" />
                <span>{stats.streakDays} 天</span>
              </div>
            )}
            {stats?.completionRate != null && (
              <div className="flex items-center gap-1.5 text-emerald-300">
                <TrendingUp className="h-4 w-4" />
                <span>{Math.round(stats.completionRate * 100)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <JustimeGlassPanel className="lg:col-span-2 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-white/80 mb-4">每日学习时长（近30天）</h2>
            {progressLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                      interval={4}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                      unit="h"
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#fff',
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}h`, '学习时长']}
                    />
                    <Bar
                      dataKey="hours"
                      fill="rgba(99,102,241,0.6)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </JustimeGlassPanel>

          <JustimeGlassPanel className="rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-white/80 mb-4">科目分布</h2>
            {statsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-white/30" />
              </div>
            ) : subjectPieData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-white/30 text-sm">
                暂无数据
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={subjectPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name} ${value}h`}
                    >
                      {subjectPieData.map((entry) => (
                        <Cell key={entry.name} fill={SUBJECT_COLORS[entry.name] || '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(0,0,0,0.8)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        fontSize: '12px',
                        color: '#fff',
                      }}
                      formatter={(value: number) => [`${value}h`]}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </JustimeGlassPanel>
        </div>

        <JustimeGlassPanel className="rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-white/80 mb-3">学习记录</h2>
          {progressLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            </div>
          ) : progress.length === 0 ? (
            <div className="text-center py-8 text-white/40 text-sm">
              暂无学习记录
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {progress.slice().reverse().map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xs text-white/30 w-16">{p.date}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30">
                    {p.subject}
                  </span>
                  <span className="text-xs text-white/50">
                    计划 {p.plannedHours}h / 实际 {p.actualHours}h
                  </span>
                  <span className="text-xs text-emerald-300 ml-auto">
                    {Math.round(p.completionRate * 100)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}
