'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, CheckCircle2, Plus } from 'lucide-react'
import { TaskItem } from '@/lib/ai/task-planner'
import { useAuth } from '@/hooks/useAuth'

interface TaskSelectorProps {
  tasks: TaskItem[]
  onTaskAdded: (task: TaskItem) => void
}

export function TaskSelector({ tasks, onTaskAdded }: TaskSelectorProps) {
  const [addingTasks, setAddingTasks] = useState<Set<string>>(new Set())
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set())
  const { user } = useAuth()

  const handleAddTask = async (task: TaskItem) => {
    if (!user) {
      alert('请先登录')
      return
    }

    const taskId = task.title
    setAddingTasks(prev => new Set(prev).add(taskId))

    try {
      const response = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          title: task.title,
          description: task.description,
          start: task.startTime || new Date().toISOString(),
          end: task.endTime || new Date(Date.now() + 3600000).toISOString(),
          type: 'task',
          priority: task.priority || 'medium',
          status: 'pending',
          aiGenerated: true
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '添加任务失败')
      }

      setAddedTasks(prev => new Set(prev).add(taskId))
      onTaskAdded(task)
    } catch (error) {
      console.error('添加任务失败:', error)
      const errorMessage = error instanceof Error ? error.message : '添加任务失败，请重试'
      alert(errorMessage)
    } finally {
      setAddingTasks(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
    }
  }

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'high':
        return '高优先级'
      case 'medium':
        return '中优先级'
      case 'low':
        return '低优先级'
      default:
        return '普通'
    }
  }

  if (tasks.length === 0) {
    return null
  }

  return (
    <Card className="mt-4 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 text-blue-900 dark:text-blue-100">
          <Calendar className="w-4 h-4" />
          AI 识别到的任务
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task, index) => {
          const taskId = task.title
          const isAdding = addingTasks.has(taskId)
          const isAdded = addedTasks.has(taskId)

          return (
            <div
              key={index}
              className="p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {task.title}
                    </h4>
                    {task.priority && (
                      <Badge className={getPriorityColor(task.priority)}>
                        {getPriorityLabel(task.priority)}
                      </Badge>
                    )}
                  </div>
                  
                  {task.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                    {task.startTime && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(task.startTime).toLocaleString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => handleAddTask(task)}
                  disabled={isAdding || isAdded}
                  className={
                    isAdded
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }
                >
                  {isAdding ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                      添加中
                    </>
                  ) : isAdded ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      已添加
                    </>
                  ) : (
                    <>
                      <Plus className="w-3 h-3 mr-1" />
                      添加到日历
                    </>
                  )}
                </Button>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
