'use client'

import { Button } from '@/components/ui/button'
import { Calendar, ListChecks, ChevronDown } from 'lucide-react'

interface TaskDecompositionCardProps {
  decomposition: any
  isExpanded: boolean
  onExpand: () => void
  onDismiss: () => void
}

export function TaskDecompositionCard({
  decomposition,
  isExpanded,
  onExpand,
  onDismiss
}: TaskDecompositionCardProps) {
  if (isExpanded) return null

  const totalHours = (decomposition.subtasks || []).reduce((sum: number, t: any) => sum + (t.duration_hours || 0), 0)

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
          <ListChecks className="w-5 h-5 text-purple-600 dark:text-purple-300" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            {decomposition.project?.name || '任务分解方案'}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            AI 已生成概要时间表
          </p>
        </div>
      </div>

      {decomposition.project?.description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
          {decomposition.project.description}
        </p>
      )}

      {/* 概要统计 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {(decomposition.subtasks || []).length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">子任务</div>
        </div>
        <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
            {decomposition.project?.total_days || '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">天</div>
        </div>
        <div className="text-center p-2 bg-white/60 dark:bg-gray-800/60 rounded-lg">
          <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
            {totalHours}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">总工时</div>
        </div>
      </div>

      {/* 子任务预览列表 */}
      <div className="space-y-1.5 mb-4">
        {(decomposition.subtasks || []).slice(0, 4).map((task: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <span className="w-5 h-5 flex items-center justify-center bg-purple-100 dark:bg-purple-800/50 text-purple-600 dark:text-purple-300 rounded text-xs font-medium">
              {task.order || idx + 1}
            </span>
            <span className="flex-1 truncate">{task.title}</span>
            <span className="text-xs text-gray-400">{task.duration_hours}h</span>
          </div>
        ))}
        {(decomposition.subtasks || []).length > 4 && (
          <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
            ... 还有 {(decomposition.subtasks || []).length - 4} 个子任务
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={onExpand}
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
        >
          <Calendar className="w-4 h-4 mr-2" />
          查看详细日程安排
          <ChevronDown className="w-4 h-4 ml-1" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDismiss}
        >
          忽略
        </Button>
      </div>
    </div>
  )
}
