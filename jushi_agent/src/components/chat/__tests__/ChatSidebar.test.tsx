import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatSidebar } from '../ChatSidebar'

jest.mock('@/hooks/useChatSessions', () => ({
  useChatSessions: jest.fn(),
}))

import { useChatSessions } from '@/hooks/useChatSessions'

describe('ChatSidebar', () => {
  const mockUseChatSessions = useChatSessions as jest.MockedFunction<typeof useChatSessions>
  const mockOnSelectSession = jest.fn()

  const mockSessions = [
    { _id: '1', title: 'Session 1', updatedAt: '2024-01-01', preview: 'Preview 1' },
    { _id: '2', title: 'Session 2', updatedAt: '2024-01-02', preview: 'Preview 2' },
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseChatSessions.mockReturnValue({
      sessions: [],
      loading: false,
      error: null,
      reload: jest.fn(),
    })
  })

  it('应该渲染新会话按钮', () => {
    render(
      <ChatSidebar
        userId="user1"
        currentSessionId={null}
        onSelectSession={mockOnSelectSession}
      />
    )

    expect(screen.getByText('新会话')).toBeInTheDocument()
  })

  it('应该显示会话列表', () => {
    mockUseChatSessions.mockReturnValue({
      sessions: mockSessions,
      loading: false,
      error: null,
      reload: jest.fn(),
    })

    render(
      <ChatSidebar
        userId="user1"
        currentSessionId={null}
        onSelectSession={mockOnSelectSession}
      />
    )

    expect(screen.getByText('Session 1')).toBeInTheDocument()
    expect(screen.getByText('Session 2')).toBeInTheDocument()
  })

  it('应该显示加载状态', () => {
    mockUseChatSessions.mockReturnValue({
      sessions: [],
      loading: true,
      error: null,
      reload: jest.fn(),
    })

    render(
      <ChatSidebar
        userId="user1"
        currentSessionId={null}
        onSelectSession={mockOnSelectSession}
      />
    )

    expect(screen.getByText('正在加载会话...')).toBeInTheDocument()
  })

  it('应该显示空状态', () => {
    mockUseChatSessions.mockReturnValue({
      sessions: [],
      loading: false,
      error: null,
      reload: jest.fn(),
    })

    render(
      <ChatSidebar
        userId="user1"
        currentSessionId={null}
        onSelectSession={mockOnSelectSession}
      />
    )

    expect(screen.getByText('暂无历史会话')).toBeInTheDocument()
  })

  it('点击新会话按钮应该调用onSelectSession(null)', async () => {
    const user = userEvent.setup()

    render(
      <ChatSidebar
        userId="user1"
        currentSessionId={null}
        onSelectSession={mockOnSelectSession}
      />
    )

    await user.click(screen.getByText('新会话'))
    expect(mockOnSelectSession).toHaveBeenCalledWith(null)
  })

  it('点击会话应该调用onSelectSession', async () => {
    const user = userEvent.setup()
    mockUseChatSessions.mockReturnValue({
      sessions: mockSessions,
      loading: false,
      error: null,
      reload: jest.fn(),
    })

    render(
      <ChatSidebar
        userId="user1"
        currentSessionId={null}
        onSelectSession={mockOnSelectSession}
      />
    )

    await user.click(screen.getByText('Session 1'))
    expect(mockOnSelectSession).toHaveBeenCalledWith('1')
  })

  it('应该高亮当前选中的会话', () => {
    mockUseChatSessions.mockReturnValue({
      sessions: mockSessions,
      loading: false,
      error: null,
      reload: jest.fn(),
    })

    render(
      <ChatSidebar
        userId="user1"
        currentSessionId="1"
        onSelectSession={mockOnSelectSession}
      />
    )

    const sessionButton = screen.getByText('Session 1').closest('button')
    expect(sessionButton).toHaveClass('border-white/20')
  })
})
