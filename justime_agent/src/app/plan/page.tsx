'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useStudyPlan } from '@/hooks/useStudyPlan'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { StudyTimeline } from '@/components/study/StudyTimeline'
import { Button } from '@/components/ui/button'
import { Loader2, ArrowLeft, Plus, GraduationCap, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import dayjs from 'dayjs'

export default function PlanPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { plan, loading, createPlan } = useStudyPlan()
  const [creating, setCreating] = useState(false)

  const handleCreatePlan = async () => {
    setCreating(true)
    try {
      await createPlan({
        planName: '考研学习计划',
        startDate: dayjs().format('YYYY-MM-DD'),
        endDate: dayjs().add(6, 'month').format('YYYY-MM-DD'),
        dailyHours: 8,
      })
    } finally {
      setCreating(false)
    }
  }

  const currentPhaseIndex = plan?.phases
    ? plan.phases.findIndex(p => {
        const start = dayjs(p.startDate)
        const end = dayjs(p.endDate)
        const now = dayjs()
        return now.isAfter(start) && now.isBefore(end)
      })
    : -1

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
      <div className="container mx-auto p-4 md:p-6 max-w-4xl space-y-4 pb-8">
        <div className="flex items-center justify-between bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow-lg">
          <div className="flex items-center gap-3">
            <Link href="/study">
              <Button variant="ghost" size="sm" className="text-white/70 hover:bg-white/10 hover:text-white">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-300" />
                学习计划
              </h1>
              {plan && (
                <p className="text-xs text-white/50 mt-0.5">
                  {plan.planName} · {plan.startDate} ~ {plan.endDate}
                </p>
              )}
            </div>
          </div>

          <Button
            onClick={handleCreatePlan}
            disabled={creating}
            className="bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-500/20"
          >
            {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            创建计划
          </Button>
        </div>

        <JustimeGlassPanel className="rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-white/80 mb-4">计划时间线</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            </div>
          ) : plan?.phases ? (
            <StudyTimeline phases={plan.phases} currentPhaseIndex={currentPhaseIndex} />
          ) : (
            <div className="text-center py-12">
              <GraduationCap className="h-16 w-16 text-white/10 mx-auto mb-4" />
              <p className="text-white/50 text-sm mb-1">暂无学习计划</p>
              <p className="text-white/30 text-xs mb-4">点击「创建计划」，AI 将为你生成个性化考研学习计划</p>
              <Button
                onClick={handleCreatePlan}
                disabled={creating}
                className="bg-blue-600 hover:bg-blue-500 text-white border-0"
              >
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                创建学习计划
              </Button>
            </div>
          )}
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}
