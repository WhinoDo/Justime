import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
    { title: '任务1', duration_hours: 2, order: 1, description: '第一个任务' },
    { title: '任务2', duration_hours: 3, order: 2, description: '第二个任务' },
    { title: '任务3', duration_hours: 1, order: 3, description: '第三个任务' },
  ],
  message: '任务分解成功',
}

describe('TaskDecompositionCard', () => {
  const mockOnConfirm = jest.fn()
  const mockOnCancel = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该渲染任务分解卡片', () => {
    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('测试项目')).toBeInTheDocument()
    expect(screen.getByText('AI 生成的任务分解方案')).toBeInTheDocument()
  })

  it('应该显示项目统计信息', () => {
    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('3 天')).toBeInTheDocument()
    expect(screen.getByText(/已选/)).toBeInTheDocument()
  })

  it('应该显示所有子任务', () => {
    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText(/1\. 任务1/)).toBeInTheDocument()
    expect(screen.getByText(/2\. 任务2/)).toBeInTheDocument()
    expect(screen.getByText(/3\. 任务3/)).toBeInTheDocument()
  })

  it('应该能够展开和收起', async () => {
    const user = userEvent.setup()

    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )

    expect(screen.getByText('全选')).toBeInTheDocument()

    const collapseButton = screen.getByRole('button', { name: '' })
    await user.click(collapseButton)

    await waitFor(() => {
      expect(screen.queryByText('全选')).not.toBeInTheDocument()
    })
  })

  it('应该能够全选和取消全选', async () => {
    const user = userEvent.setup()

    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )

    await user.click(screen.getByText('取消全选'))
    expect(screen.getByText('已选 0/3')).toBeInTheDocument()

    await user.click(screen.getByText('全选'))
    expect(screen.getByText('已选 3/3')).toBeInTheDocument()
  })

  it('应该能够点击取消按钮', async () => {
    const user = userEvent.setup()

    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )

    await user.click(screen.getByText('取消'))
    expect(mockOnCancel).toHaveBeenCalled()
  })

  it('应该能够确认添加任务', async () => {
    const user = userEvent.setup()
    mockOnConfirm.mockResolvedValue(undefined)

    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )

    const confirmButton = screen.getByText(/添加.*个任务到日历/)
    await user.click(confirmButton)

    await waitFor(() => {
      expect(mockOnConfirm).toHaveBeenCalled()
    })
  })

  it('确认按钮在没有选中任务时应该禁用', async () => {
    const user = userEvent.setup()

    render(
      <TaskDecompositionCard
        decomposition={mockDecomposition}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    )

    await user.click(screen.getByText('取消全选'))

    const confirmButton = screen.getByText(/添加.*个任务到日历/)
    expect(confirmButton).toBeDisabled()
  })
})
