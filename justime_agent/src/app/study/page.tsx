'use client'

import { useAuth } from '@/hooks/useAuth'
import { useStudyProfile, useStudyTasks } from '@/hooks/useStudyPlan'
import { useProgressStats } from '@/hooks/useProgress'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { ProgressOverview } from '@/components/study/ProgressOverview'
import { DailyTasks } from '@/components/study/DailyTasks'
import { QuickActions } from '@/components/study/QuickActions'
import { Loader2, ArrowLeft, GraduationCap } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import dayjs from 'dayjs'

export default function StudyPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useAuth()
  const { profile, loading: profileLoading } = useStudyProfile()
  const { stats, loading: statsLoading } = useProgressStats()
  const today = dayjs().format('YYYY-MM-DD')
  const { tasks, loading: tasksLoading, updateTaskStatus } = useStudyTasks(today)

  if (authLoading) {
    return (
      <JustimePageShell blur="xl" contentClassName="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </JustimePageShell>
    )
  }

  if (!isAuthenticated || !user) return null

  return (
    <JustimePageShell fullHeight blur="lg" opacity={0.4} contentClassName="h-full overflow-y-auto">
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-4 pb-8">
        <div className="flex items-center justify-between bg-muted/50 backdrop-blur-xl p-4 rounded-2xl border border-border shadow-lg">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:bg-accent/50 hover:text-foreground">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-blue-500 dark:text-blue-300" />
                考研学习
              </h1>
              {profile && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {profile.targetSchool} · {profile.targetMajor} · 每日 {profile.dailyStudyHours}h
                </p>
              )}
            </div>
          </div>
        </div>

        <ProgressOverview stats={stats} loading={statsLoading} />

        <QuickActions />

        <JustimeGlassPanel className="rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-foreground/80 mb-3">今日任务</h2>
          <DailyTasks tasks={tasks} loading={tasksLoading} onUpdateStatus={updateTaskStatus} />
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}