'use client'

import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { JustimePageShell } from '@/components/layout/JustimePageShell'
import { TaskCockpit } from '@/components/tasks/TaskCockpit'
import { TaskCreateLauncher } from '@/components/tasks/TaskCreateLauncher'
import { useAuth } from '@/hooks/useAuth'
import { useTaskProcesses } from '@/hooks/useTaskProcesses'
import { useDesktopRuntime } from '@/hooks/useDesktopRuntime'
import { DesktopAppFrame } from '@/components/layout/DesktopAppFrame'

export default function TasksPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const { tasks, loading, createTask } = useTaskProcesses({ enabled: isAuthenticated })
  const { isDesktop } = useDesktopRuntime()

  const taskList = useMemo(() => tasks, [tasks])

  if (authLoading) return null

  if (isDesktop) {
    return (
      <JustimePageShell fullHeight variant="desktop" blur="none" opacity={0} contentClassName="h-full">
        <DesktopAppFrame
          title="Task Process OS"
          subtitle="Before, During, After"
          toolbar={
            <TaskCreateLauncher
              buttonLabel="新建任务"
              createTask={createTask}
              buttonProps={{ className: 'h-8 rounded-lg bg-violet-600 px-3 text-xs text-white shadow-[0_12px_32px_rgba(126,87,194,0.28)] hover:bg-violet-500' }}
              buttonContent={<><Plus className="mr-1.5 h-3.5 w-3.5" />新建任务</>}
            />
          }
        >
          <TaskCockpit tasks={taskList} loading={loading} variant="desktop" />
        </DesktopAppFrame>
      </JustimePageShell>
    )
  }

  return (
    <JustimePageShell blur="lg" opacity={0.35} contentClassName="px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap justify-end gap-3">
          <TaskCreateLauncher
            buttonLabel="新建任务"
            createTask={createTask}
            buttonProps={{ className: 'rounded-2xl bg-white text-slate-950 hover:bg-white/90' }}
            buttonContent={<><Plus className="mr-2 h-4 w-4" />新建任务</>}
          />
        </div>
        <TaskCockpit tasks={taskList} loading={loading} />
      </div>
    </JustimePageShell>
  )
}
