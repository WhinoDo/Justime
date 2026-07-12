import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskCockpit } from '../TaskCockpit'
import type { TaskProcess } from '@/types/taskProcess'

const tasks: TaskProcess[] = [
  {
    id: 'task-1',
    userId: 'user-1',
    title: '学习 Python 虚拟环境',
    description: '理解 venv 与依赖隔离',
    goal: '完成虚拟环境学习和知识沉淀',
    category: 'learning',
    tags: ['python', 'venv'],
    status: 'active',
    phase: 'during',
    priority: 'high',
    progress: 0.6,
    progress_source: 'evidence',
    actual_hours: 2.5,
    milestones: [],
    blockers: [],
    ai_suggestions: [],
    related_chat_session_ids: [],
    related_calendar_event_ids: [],
    evidence_count: 3,
    knowledge_output_count: 1,
  },
  {
    id: 'task-2',
    userId: 'user-1',
    title: '整理项目复盘',
    description: '输出 after 阶段总结',
    goal: '沉淀项目经验',
    category: 'writing',
    tags: ['review'],
    status: 'completed',
    phase: 'after',
    priority: 'medium',
    progress: 1,
    progress_source: 'ai',
    actual_hours: 1,
    milestones: [],
    blockers: [],
    ai_suggestions: [],
    related_chat_session_ids: [],
    related_calendar_event_ids: [],
    evidence_count: 2,
    knowledge_output_count: 2,
  },
]

describe('TaskCockpit', () => {
  it('renders backend results, query controls, and pagination metadata', () => {
    const onQueryChange = jest.fn()
    render(
      <TaskCockpit
        tasks={tasks}
        loading={false}
        query={{ page: 2, search: '', sort_by: 'updatedAt', sort_order: 'desc' }}
        total={25}
        totalPages={3}
        onQueryChange={onQueryChange}
      />,
    )

    expect(screen.getByText('任务驾驶舱')).toBeInTheDocument()
    expect(screen.getByText('活跃任务')).toBeInTheDocument()
    expect(screen.getByText('学习 Python 虚拟环境')).toBeInTheDocument()
    expect(screen.getByText('整理项目复盘')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('2.5h')).toBeInTheDocument()
    expect(screen.getByText('共 25 项，当前第 2 页')).toBeInTheDocument()
    expect(screen.getByText('共 25 项 · 第 2 / 3 页')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('搜索任务'), { target: { value: 'Python' } })
    fireEvent.change(screen.getByLabelText('阶段筛选'), { target: { value: 'during' } })
    fireEvent.change(screen.getByLabelText('分类筛选'), { target: { value: 'learning' } })
    fireEvent.change(screen.getByLabelText('任务排序'), { target: { value: 'progress:asc' } })
    fireEvent.click(screen.getByRole('button', { name: '下一页' }))

    expect(onQueryChange).toHaveBeenCalledWith({ search: 'Python' })
    expect(onQueryChange).toHaveBeenCalledWith({ phase: 'during' })
    expect(onQueryChange).toHaveBeenCalledWith({ category: 'learning' })
    expect(onQueryChange).toHaveBeenCalledWith({ sort_by: 'progress', sort_order: 'asc' })
    expect(onQueryChange).toHaveBeenCalledWith({ page: 3 })
  })

  it('renders desktop variant through TaskCockpit', () => {
    render(<TaskCockpit tasks={tasks} loading={false} variant="desktop" />)

    expect(screen.getByTestId('task-cockpit-desktop')).toBeInTheDocument()
    expect(screen.getByText('Query')).toBeInTheDocument()
    expect(screen.getByLabelText('阶段筛选')).toBeInTheDocument()
  })
})
