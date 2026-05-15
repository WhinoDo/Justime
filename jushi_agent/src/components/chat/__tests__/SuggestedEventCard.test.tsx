import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestedEventCard } from '../SuggestedEventCard'
import type { SuggestedCalendarEvent } from '@/types'

const mockEvent: SuggestedCalendarEvent = {
  title: '测试会议',
  description: '这是一个测试会议',
  start: '2024-01-15T10:00:00',
  end: '2024-01-15T11:00:00',
  type: 'meeting',
  location: '会议室A',
}

describe('SuggestedEventCard', () => {
  const mockOnConfirm = jest.fn()
  const mockOnDismiss = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该渲染事件卡片', () => {
    render(
      <SuggestedEventCard
        event={mockEvent}
        onConfirm={mockOnConfirm}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('测试会议')).toBeInTheDocument()
    expect(screen.getByText('这是一个测试会议')).toBeInTheDocument()
    expect(screen.getByText('会议室A')).toBeInTheDocument()
  })

  it('应该显示事件类型标签', () => {
    render(
      <SuggestedEventCard
        event={mockEvent}
        onConfirm={mockOnConfirm}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('会议')).toBeInTheDocument()
  })

  it('应该显示AI Insight标签', () => {
    render(
      <SuggestedEventCard
        event={mockEvent}
        onConfirm={mockOnConfirm}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('AI Insight')).toBeInTheDocument()
  })

  it('点击确认按钮应该调用onConfirm', async () => {
    const user = userEvent.setup()
    mockOnConfirm.mockResolvedValue({ _id: 'event-1' })

    render(
      <SuggestedEventCard
        event={mockEvent}
        onConfirm={mockOnConfirm}
        onDismiss={mockOnDismiss}
      />
    )

    await user.click(screen.getByText('确认添加'))

    expect(mockOnConfirm).toHaveBeenCalledWith(mockEvent)
  })

  it('点击取消按钮应该调用onDismiss', async () => {
    const user = userEvent.setup()

    render(
      <SuggestedEventCard
        event={mockEvent}
        onConfirm={mockOnConfirm}
        onDismiss={mockOnDismiss}
      />
    )

    const dismissButton = screen.getByRole('button', { name: '' })
    await user.click(dismissButton)

    expect(mockOnDismiss).toHaveBeenCalled()
  })

  it('确认成功后应该显示成功状态', async () => {
    const user = userEvent.setup()
    mockOnConfirm.mockResolvedValue({ _id: 'event-1' })

    render(
      <SuggestedEventCard
        event={mockEvent}
        onConfirm={mockOnConfirm}
        onDismiss={mockOnDismiss}
      />
    )

    await user.click(screen.getByText('确认添加'))

    await screen.findByText('已加入日程')
    expect(screen.getByText('测试会议')).toBeInTheDocument()
  })

  it('确认失败后应该显示错误信息', async () => {
    const user = userEvent.setup()
    mockOnConfirm.mockRejectedValue(new Error('添加失败'))

    render(
      <SuggestedEventCard
        event={mockEvent}
        onConfirm={mockOnConfirm}
        onDismiss={mockOnDismiss}
      />
    )

    await user.click(screen.getByText('确认添加'))

    await screen.findByText('添加失败')
  })

  it('应该显示资源链接', () => {
    const eventWithResources: SuggestedCalendarEvent = {
      ...mockEvent,
      resources: [
        { title: '相关文档', url: 'https://example.com/doc' },
      ],
    }

    render(
      <SuggestedEventCard
        event={eventWithResources}
        onConfirm={mockOnConfirm}
        onDismiss={mockOnDismiss}
      />
    )

    expect(screen.getByText('相关资源')).toBeInTheDocument()
    expect(screen.getByText('相关文档')).toBeInTheDocument()
  })
})
