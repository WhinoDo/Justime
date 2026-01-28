'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Calendar, Clock, Plus, Trash2, GripVertical,
    ChevronDown, ChevronUp, Sparkles, Edit3, Save, X,
    CheckCircle
} from 'lucide-react'

interface EditableSubtask {
    id: string
    title: string
    duration_hours: number
    order: number
    description: string
    selected: boolean
    isEditing: boolean
}

interface EditableProject {
    name: string
    description: string
    total_days: number
    start_date: string
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
    subtasks: Array<{
        title: string
        duration_hours: number
        order: number
        description?: string
    }>
    message: string
}

interface EditableTaskPlanProps {
    decomposition: TaskDecomposition
    onConfirm: (project: EditableProject, selectedTasks: EditableSubtask[]) => void
    onCancel: () => void
}

export function EditableTaskPlan({
    decomposition,
    onConfirm,
    onCancel
}: EditableTaskPlanProps) {
    const [project, setProject] = useState<EditableProject>({
        name: decomposition.project.name,
        description: decomposition.project.description || '',
        total_days: decomposition.project.total_days,
        start_date: decomposition.project.start_date
    })

    const [subtasks, setSubtasks] = useState<EditableSubtask[]>(
        decomposition.subtasks.map((task, index) => ({
            id: `task-${index}`,
            title: task.title,
            duration_hours: task.duration_hours,
            order: task.order,
            description: task.description || '',
            selected: true,
            isEditing: false
        }))
    )

    const [expanded, setExpanded] = useState(true)
    const [loading, setLoading] = useState(false)
    const [editingProject, setEditingProject] = useState(false)

    // 切换任务选中状态
    const toggleTask = (id: string) => {
        setSubtasks(prev => prev.map(task =>
            task.id === id ? { ...task, selected: !task.selected } : task
        ))
    }

    // 开始编辑任务
    const startEditing = (id: string) => {
        setSubtasks(prev => prev.map(task =>
            task.id === id ? { ...task, isEditing: true } : task
        ))
    }

    // 保存任务编辑
    const saveEditing = (id: string) => {
        setSubtasks(prev => prev.map(task =>
            task.id === id ? { ...task, isEditing: false } : task
        ))
    }

    // 取消任务编辑
    const cancelEditing = (id: string, originalTask: EditableSubtask) => {
        setSubtasks(prev => prev.map(task =>
            task.id === id ? { ...originalTask, isEditing: false } : task
        ))
    }

    // 更新任务字段
    const updateTask = (id: string, field: keyof EditableSubtask, value: any) => {
        setSubtasks(prev => prev.map(task =>
            task.id === id ? { ...task, [field]: value } : task
        ))
    }

    // 添加新任务
    const addTask = () => {
        const newOrder = subtasks.length + 1
        setSubtasks(prev => [...prev, {
            id: `task-new-${Date.now()}`,
            title: '新任务',
            duration_hours: 1,
            order: newOrder,
            description: '',
            selected: true,
            isEditing: true
        }])
    }

    // 删除任务
    const deleteTask = (id: string) => {
        setSubtasks(prev => {
            const filtered = prev.filter(task => task.id !== id)
            // 重新排序
            return filtered.map((task, index) => ({
                ...task,
                order: index + 1
            }))
        })
    }

    // 全选/取消全选
    const selectAll = () => {
        setSubtasks(prev => prev.map(task => ({ ...task, selected: true })))
    }

    const deselectAll = () => {
        setSubtasks(prev => prev.map(task => ({ ...task, selected: false })))
    }

    // 确认提交
    const handleConfirm = async () => {
        const selected = subtasks.filter(t => t.selected)
        if (selected.length === 0) {
            alert('请至少选择一个任务')
            return
        }
        setLoading(true)
        try {
            await onConfirm(project, selected)
        } finally {
            setLoading(false)
        }
    }

    const selectedCount = subtasks.filter(t => t.selected).length
    const totalHours = subtasks.filter(t => t.selected).reduce((sum, t) => sum + t.duration_hours, 0)

    return (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-200 dark:border-purple-800 p-4 mt-3 shadow-sm">
            {/* 项目头部 */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-purple-100 dark:bg-purple-800 rounded-lg">
                        <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                    </div>

                    {editingProject ? (
                        <div className="flex-1 space-y-2">
                            <Input
                                value={project.name}
                                onChange={(e) => setProject({ ...project, name: e.target.value })}
                                placeholder="项目名称"
                                className="font-semibold"
                            />
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={project.total_days}
                                    onChange={(e) => setProject({ ...project, total_days: parseInt(e.target.value) || 1 })}
                                    className="w-24"
                                    min={1}
                                />
                                <span className="text-sm text-gray-500 self-center">天</span>
                                <Input
                                    type="date"
                                    value={project.start_date.split('T')[0]}
                                    onChange={(e) => setProject({ ...project, start_date: e.target.value })}
                                    className="w-40"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={() => setEditingProject(false)}>
                                    <Save className="w-3 h-3 mr-1" /> 保存
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => setEditingProject(false)}>
                                    取消
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1">
                            <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                    {project.name}
                                </h4>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => setEditingProject(true)}
                                >
                                    <Edit3 className="w-3 h-3" />
                                </Button>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                AI 生成的任务计划 · 可编辑
                            </p>
                        </div>
                    )}
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

            {/* 统计信息 */}
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {project.total_days} 天
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
                        <Button variant="outline" size="sm" onClick={addTask}>
                            <Plus className="w-3 h-3 mr-1" /> 添加任务
                        </Button>
                    </div>

                    {/* 可编辑子任务列表 */}
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                        {subtasks.map((task) => (
                            <div
                                key={task.id}
                                className={`rounded-lg transition-all ${task.selected
                                        ? 'bg-white dark:bg-gray-800 border border-purple-300 dark:border-purple-600 shadow-sm'
                                        : 'bg-gray-100 dark:bg-gray-700/50 border border-transparent opacity-60'
                                    }`}
                            >
                                {task.isEditing ? (
                                    // 编辑模式
                                    <div className="p-3 space-y-2">
                                        <div className="flex gap-2">
                                            <Input
                                                value={task.title}
                                                onChange={(e) => updateTask(task.id, 'title', e.target.value)}
                                                placeholder="任务标题"
                                                className="flex-1"
                                            />
                                            <Input
                                                type="number"
                                                value={task.duration_hours}
                                                onChange={(e) => updateTask(task.id, 'duration_hours', parseFloat(e.target.value) || 1)}
                                                className="w-20"
                                                min={0.5}
                                                step={0.5}
                                            />
                                            <span className="text-sm text-gray-500 self-center">小时</span>
                                        </div>
                                        <Textarea
                                            value={task.description}
                                            onChange={(e) => updateTask(task.id, 'description', e.target.value)}
                                            placeholder="任务描述（可选）"
                                            rows={2}
                                        />
                                        <div className="flex justify-end gap-2">
                                            <Button size="sm" variant="ghost" onClick={() => deleteTask(task.id)}>
                                                <Trash2 className="w-3 h-3 mr-1" /> 删除
                                            </Button>
                                            <Button size="sm" onClick={() => saveEditing(task.id)}>
                                                <Save className="w-3 h-3 mr-1" /> 保存
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    // 显示模式
                                    <div
                                        className="flex items-start gap-3 p-3 cursor-pointer"
                                        onClick={() => toggleTask(task.id)}
                                    >
                                        <div className="mt-0.5">
                                            {task.selected ? (
                                                <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                            ) : (
                                                <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className={`font-medium ${task.selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500'}`}>
                                                    {task.order}. {task.title}
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-gray-500 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {task.duration_hours}h
                                                    </span>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-6 w-6 p-0"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            startEditing(task.id)
                                                        }}
                                                    >
                                                        <Edit3 className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                            {task.description && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {task.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
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
