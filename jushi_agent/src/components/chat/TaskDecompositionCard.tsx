'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CheckCircle, Circle, Calendar, Clock, ChevronDown, ChevronUp, Sparkles } from 'lucide-react'

interface Subtask {
    title: string
    duration_hours: number
    order: number
    description?: string
    selected?: boolean
}

interface TaskDecomposition {
    success: boolean
    type: string
    project: {
        name: string
        description?: string
        total_days: number
        start_date: string
        subtask_count: number
    }
    subtasks: Subtask[]
    message: string
}

interface TaskDecompositionCardProps {
    decomposition: TaskDecomposition
    onConfirm: (selectedTasks: Subtask[]) => void
    onCancel: () => void
}

export function TaskDecompositionCard({
    decomposition,
    onConfirm,
    onCancel
}: TaskDecompositionCardProps) {
    const [subtasks, setSubtasks] = useState<Subtask[]>(
        decomposition.subtasks.map(task => ({ ...task, selected: true }))
    )
    const [expanded, setExpanded] = useState(true)
    const [loading, setLoading] = useState(false)

    const toggleTask = (index: number) => {
        setSubtasks(prev => prev.map((task, i) =>
            i === index ? { ...task, selected: !task.selected } : task
        ))
    }

    const selectAll = () => {
        setSubtasks(prev => prev.map(task => ({ ...task, selected: true })))
    }

    const deselectAll = () => {
        setSubtasks(prev => prev.map(task => ({ ...task, selected: false })))
    }

    const handleConfirm = async () => {
        const selected = subtasks.filter(t => t.selected)
        if (selected.length === 0) {
            alert('请至少选择一个任务')
            return
        }
        setLoading(true)
        try {
            await onConfirm(selected)
        } finally {
            setLoading(false)
        }
    }

    const selectedCount = subtasks.filter(t => t.selected).length
    const totalHours = subtasks.filter(t => t.selected).reduce((sum, t) => sum + t.duration_hours, 0)

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 mt-3 shadow-sm">
            {/* 头部 */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                        <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                    </div>
                    <div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                            {decomposition.project.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            AI 生成的任务分解方案
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(!expanded)}
                    className="text-gray-500"
                >
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
            </div>

            {/* 项目信息 */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {decomposition.project.total_days} 天
                </span>
                <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {totalHours} 小时
                </span>
                <span className="text-purple-600 dark:text-purple-400">
                    已选 {selectedCount}/{subtasks.length}
                </span>
            </div>

            {expanded && (
                <>
                    {/* 快捷操作 */}
                    <div className="flex gap-2 mb-3">
                        <Button variant="outline" size="sm" onClick={selectAll}>
                            全选
                        </Button>
                        <Button variant="outline" size="sm" onClick={deselectAll}>
                            取消全选
                        </Button>
                    </div>

                    {/* 子任务列表 */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                        {subtasks.map((task, index) => (
                            <div
                                key={index}
                                onClick={() => toggleTask(index)}
                                className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${task.selected
                                        ? 'bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 shadow-sm'
                                        : 'bg-gray-100 dark:bg-gray-700/50 border border-transparent opacity-60'
                                    }`}
                            >
                                <div className="mt-0.5">
                                    {task.selected ? (
                                        <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    ) : (
                                        <Circle className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <span className={`font-medium ${task.selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                            {task.order}. {task.title}
                                        </span>
                                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {task.duration_hours}h
                                        </span>
                                    </div>
                                    {task.description && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                            {task.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-purple-200 dark:border-purple-800">
                        <Button variant="outline" size="sm" onClick={onCancel}>
                            取消
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleConfirm}
                            disabled={loading || selectedCount === 0}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {loading ? '添加中...' : `添加 ${selectedCount} 个任务到日历`}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
