import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { TaskCockpitDesktop } from '../TaskCockpitDesktop'
import type { TaskProcess } from '@/types/taskProcess'

const tasks: TaskProcess[] = [
  {
    id: 'task-1',
    userId: 'user-1',
    title: '推进 macOS 桌面端',
    description: '桌面 UI 优化',
    goal: '完成桌面工作台',
    category: 'project',
    tags: ['desktop'],
    status: 'active',
    phase: 'during',
    priority: 'high',
    progress: 0.5,
    progress_source: 'evidence',
    actual_hours: 3,
    milestones: [],
    blockers: [],
    ai_suggestions: [],
    related_chat_session_ids: [],
    related_calendar_event_ids: [],
    evidence_count: 4,
    knowledge_output_count: 1,
  },
]

describe('TaskCockpitDesktop', () => {
  it('renders backend results, query controls, pagination, and page metrics', () => {
    const onQueryChange = jest.fn()
    render(
      <TaskCockpitDesktop
        tasks={tasks}
        query={{ page: 2, sort_by: 'updatedAt', sort_order: 'desc' }}
        total={31}
        totalPages={4}
        onQueryChange={onQueryChange}
      />,
    )

    expect(screen.getByText('Query')).toBeInTheDocument()
    expect(screen.getByText('共 31 项 · 第 2 页')).toBeInTheDocument()
    expect(screen.getByText('第 2 / 4 页')).toBeInTheDocument()
    expect(screen.getByText('推进 macOS 桌面端')).toBeInTheDocument()
    expect(screen.getByText('累计投入')).toBeInTheDocument()
    expect(screen.getByText('当前页阶段分布')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('状态筛选'), { target: { value: 'active' } })
    fireEvent.change(screen.getByLabelText('优先级筛选'), { target: { value: 'high' } })
    fireEvent.click(screen.getByRole('button', { name: '上一页' }))

    expect(onQueryChange).toHaveBeenCalledWith({ status: 'active' })
    expect(onQueryChange).toHaveBeenCalledWith({ priority: 'high' })
    expect(onQueryChange).toHaveBeenCalledWith({ page: 1 })
  })
})
