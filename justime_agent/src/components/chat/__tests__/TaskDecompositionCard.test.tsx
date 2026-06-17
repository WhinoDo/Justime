import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TaskDecompositionCard } from '../TaskDecompositionCard'

const mockDecomposition = {
  success: true,
  type: 'project',
  project: {
    name: '测试项目',
    description: '这是一个测试项目',
    total_days: 3,
    start_date: '2024-01-01',
    subtask_count: 3,
  },
  subtasks: [
    { id: '1', title: '任务1', duration_hours: 2, order: 1, description: '第一个任务' },
    { id: '2', title: '任务2', duration_hours: 3, order: 2, description: '第二个任务' },
    { id: '3', title: '任务3', duration_hours: 1, order: 3, description: '第三个任务' },
  ],
  message: '任务分解成功',
}

describe('TaskDecompositionCard', () => {
  const mockOnExpand = jest.fn()
  const mockOnDismiss = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders decomposition summary card', () => {
    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        isExpanded={false}
        onExpand={mockOnExpand}
        onDismiss={mockOnDismiss}
      />,
    )

    expect(screen.getByText('测试项目')).toBeInTheDocument()
    expect(screen.getByText('AI 已生成概要时间表')).toBeInTheDocument()
    expect(screen.getByText('总工时')).toBeInTheDocument()
  })

  it('shows preview subtasks', () => {
    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        isExpanded={false}
        onExpand={mockOnExpand}
        onDismiss={mockOnDismiss}
      />,
    )

    expect(screen.getByText('任务1')).toBeInTheDocument()
    expect(screen.getByText('任务2')).toBeInTheDocument()
    expect(screen.getByText('任务3')).toBeInTheDocument()
  })

  it('triggers expand and dismiss actions', async () => {
    const user = userEvent.setup()
    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        isExpanded={false}
        onExpand={mockOnExpand}
        onDismiss={mockOnDismiss}
      />,
    )

    await user.click(screen.getByRole('button', { name: /查看详细日程安排/i }))
    expect(mockOnExpand).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '忽略' }))
    expect(mockOnDismiss).toHaveBeenCalled()
  })

  it('returns null when expanded', () => {
    const { container } = render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        isExpanded
        onExpand={mockOnExpand}
        onDismiss={mockOnDismiss}
      />,
    )

    expect(container.firstChild).toBeNull()
  })
})
