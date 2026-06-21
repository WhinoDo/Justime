'use client'

import Link from 'next/link'
import { Suspense, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, BookOpenCheck, Clock3, Filter, GraduationCap, Loader2, Search, Sparkles } from 'lucide-react'
import { JustimeGlassPanel } from '@/components/layout/JustimeGlassPanel'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { TaskCreateLauncher } from '@/components/tasks/TaskCreateLauncher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/hooks/useAuth'
import { useTaskProcesses } from '@/hooks/useTaskProcesses'
import { cn } from '@/lib/utils'
import type { TaskCategory, TaskPhase, TaskProcess, TaskStatus } from '@/types/taskProcess'

const learningCategories: TaskCategory[] = ['learning', 'reading', 'practice', 'research']
const categoryLabels: Record<TaskCategory | 'all', string> = {
  all: '全部学习类',
  learning: '学习',
  reading: '阅读',
  practice: '练习',
  research: '研究',
  development: '开发',
  writing: '写作',
  project: '项目',
  other: '其他',
}

  if (authLoading) {
    return (
      <JustimePageShell blur="xl" contentClassName="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </JustimePageShell>
    )
  }

  const filteredTasks = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return tasks.filter((task) => {
      if (category !== 'all' && task.category !== category) return false
      if (phase !== 'all' && task.phase !== phase) return false
      if (status !== 'all' && task.status !== status) return false
      if (!keyword) return true
      return [task.title, task.goal, task.description, ...task.tags].some((item) => item.toLowerCase().includes(keyword))
    })
  }, [category, phase, search, status, tasks])

  const stats = useMemo(() => {
    const active = filteredTasks.filter((task) => task.status === 'active' || task.status === 'blocked').length
    const completed = filteredTasks.filter((task) => task.status === 'completed').length
    const evidence = filteredTasks.reduce((sum, task) => sum + task.evidence_count, 0)
    const hours = filteredTasks.reduce((sum, task) => sum + task.actual_hours, 0)
    return { active, completed, evidence, hours }
  }, [filteredTasks])

  if (authLoading) return null

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
            <TaskCreateLauncher
              buttonLabel="新建学习任务"
              createTask={createTask}
              initialCategory="learning"
              buttonProps={{ className: 'rounded-2xl bg-emerald-200 text-slate-950 hover:bg-emerald-100' }}
            />
          </div>
        </JustimeGlassPanel>

        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: '筛选后任务', value: filteredTasks.length, icon: Filter },
            { label: '推进中', value: stats.active, icon: Sparkles },
            { label: 'Evidence', value: stats.evidence, icon: BookOpenCheck },
            { label: '学习投入', value: formatHours(stats.hours), icon: Clock3 },
          ].map((item) => (
            <JustimeGlassPanel key={item.label} className="rounded-[28px] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">{item.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
                </div>
                <item.icon className="h-5 w-5 text-white/[0.65]" />
              </div>
            </JustimeGlassPanel>
          ))}
        </div>

        <JustimeGlassPanel className="rounded-[32px] p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <Input
                value={search}
                onChange={(event) => setQuery('q', event.target.value)}
                placeholder="搜索学习任务、目标或标签"
                className="border-white/10 bg-white/5 pl-9 text-white placeholder:text-white/[0.35]"
              />
            </div>
            <Select value={category} onValueChange={(value) => setQuery('category', value)}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                {(['all', ...learningCategories] as const).map((item) => (
                  <SelectItem key={item} value={item} className="text-white hover:bg-white/10 focus:bg-white/10">
                    {categoryLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={phase} onValueChange={(value) => setQuery('phase', value)}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                {(['all', 'before', 'during', 'after'] as const).map((item) => (
                  <SelectItem key={item} value={item} className="text-white hover:bg-white/10 focus:bg-white/10">
                    {phaseLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setQuery('status', value)}>
              <SelectTrigger className="border-white/10 bg-white/5 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-slate-900 text-white">
                {(['all', 'draft', 'planned', 'active', 'paused', 'blocked', 'completed', 'archived'] as const).map((item) => (
                  <SelectItem key={item} value={item} className="text-white hover:bg-white/10 focus:bg-white/10">
                    {statusLabels[item]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </JustimeGlassPanel>

        <QuickActions />

        <JustimeGlassPanel className="rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-foreground/80 mb-3">今日任务</h2>
          <DailyTasks tasks={tasks} loading={tasksLoading} onUpdateStatus={updateTaskStatus} />
        </JustimeGlassPanel>
      </div>
    </JustimePageShell>
  )
}