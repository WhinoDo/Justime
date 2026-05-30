'use client'

import { StudyTask, TaskStatus, Subject } from '@/types/study'
import { CheckCircle2, Circle, Clock, SkipForward, BookOpen, RotateCcw, PenTool, FileCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailyTasksProps {
  tasks: StudyTask[]
  loading: boolean
  onUpdateStatus: (taskId: string, status: TaskStatus) => Promise<{ success: boolean }>
}

const taskTypeConfig: Record<string, { label: string; icon: typeof BookOpen; color: string }> = {
  study: { label: '学习', icon: BookOpen, color: 'text-blue-300' },
  review: { label: '复习', icon: RotateCcw, color: 'text-amber-300' },
  practice: { label: '练习', icon: PenTool, color: 'text-emerald-300' },
  mock_exam: { label: '模拟考', icon: FileCheck, color: 'text-rose-300' },
}

const subjectColors: Record<Subject, string> = {
  '数学': 'bg-blue-500/20 text-blue-200 border-blue-400/30',
  '英语': 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  '政治': 'bg-amber-500/20 text-amber-200 border-amber-400/30',
  '专业课': 'bg-purple-500/20 text-purple-200 border-purple-400/30',
}

const statusIcons: Record<TaskStatus, typeof CheckCircle2> = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  skipped: SkipForward,
}

export function DailyTasks({ tasks, loading, onUpdateStatus }: DailyTasksProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-2xl bg-white/5 animate-pulse" />
        ))}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <BookOpen className="h-12 w-12 text-white/20 mx-auto mb-3" />
        <p className="text-white/50 text-sm">今日暂无学习任务</p>
        <p className="text-white/30 text-xs mt-1">创建学习计划后，任务将自动安排</p>
      </div>
    )
  }

  const nextStatusMap: Record<TaskStatus, TaskStatus> = {
    pending: 'in_progress',
    in_progress: 'completed',
    completed: 'completed',
    skipped: 'pending',
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => {
        const typeConf = taskTypeConfig[task.taskType] || taskTypeConfig.study
        const TypeIcon = typeConf.icon
        const StatusIcon = statusIcons[task.status]
        const isCompleted = task.status === 'completed'

        return (
          <div
            key={task.id}
            className={cn(
              'group flex items-center gap-3 p-3 rounded-2xl border transition-all duration-200',
              'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20',
              isCompleted && 'opacity-60'
            )}
          >
            <button
              onClick={() => onUpdateStatus(task.id, nextStatusMap[task.status])}
              className="flex-shrink-0"
            >
              <StatusIcon
                className={cn(
                  'h-5 w-5 transition-colors',
                  isCompleted ? 'text-emerald-400' : 'text-white/40 hover:text-white/70'
                )}
              />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <TypeIcon className={cn('h-3.5 w-3.5', typeConf.color)} />
                <span className={cn(
                  'text-sm font-medium',
                  isCompleted ? 'line-through text-white/50' : 'text-white'
                )}>
                  {task.title}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full border',
                  subjectColors[task.subject]
                )}>
                  {task.subject}
                </span>
                <span className="text-white/30 text-xs">{task.durationHours}h</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
