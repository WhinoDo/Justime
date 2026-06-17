'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button, type ButtonProps } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { TaskProcessFormDialog } from '@/components/tasks/TaskProcessFormDialog'
import type { TaskCategory, TaskProcess, TaskProcessCreatePayload } from '@/types/taskProcess'

interface CreateTaskResult {
  success: boolean
  data?: { task: Pick<TaskProcess, 'id' | 'title'> }
  error?: string
}

interface TaskCreateLauncherProps {
  buttonLabel: string
  createTask: (payload: TaskProcessCreatePayload) => Promise<CreateTaskResult>
  initialCategory?: TaskCategory
  buttonProps?: ButtonProps
  buttonContent?: ReactNode
}

export function TaskCreateLauncher({
  buttonLabel,
  createTask,
  initialCategory = 'other',
  buttonProps,
  buttonContent,
}: TaskCreateLauncherProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" {...buttonProps} onClick={() => setOpen(true)}>
        {buttonContent || buttonLabel}
      </Button>
      <TaskProcessFormDialog
        open={open}
        mode="create"
        initialCategory={initialCategory}
        onOpenChange={setOpen}
        onSubmit={async (payload) => {
          const result = await createTask(payload as TaskProcessCreatePayload)
          if (result.success && result.data?.task?.id) {
            toast({
              title: '任务已创建',
              description: `已进入 ${result.data.task.title || '任务详情'}。`,
            })
            router.push(`/tasks/${result.data.task.id}`)
            return { success: true }
          }
          toast({
            title: '任务创建失败',
            description: result.error || '请稍后重试',
            variant: 'destructive',
          })
          return { success: false, error: result.error }
        }}
      />
    </>
  )
}
