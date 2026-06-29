import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatInterface } from '../ChatInterface'

jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: jest.fn(),
  }),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    isLoading: false,
    isAuthenticated: true,
  }),
}))

global.fetch = jest.fn()

describe('ChatInterface', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { configs: [] } }),
    } as Response)
  })

  it('应该渲染聊天界面', async () => {
    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByText('矩时智能助手')).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')).toBeInTheDocument()
  })

  it('应该显示空状态提示', async () => {
    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByText('开始对话')).toBeInTheDocument()
    })
    expect(screen.getByText('情绪感知')).toBeInTheDocument()
    expect(screen.getByText('任务拆解')).toBeInTheDocument()
    expect(screen.getByText('智能陪伴')).toBeInTheDocument()
  })

  it('应该允许用户输入消息', async () => {
    const user = userEvent.setup()

    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')
    await user.type(input, '测试消息')

    expect(input).toHaveValue('测试消息')
  })

  it('发送按钮在没有输入时应该禁用', async () => {
    render(<ChatInterface />)

    await waitFor(() => {
      const sendButton = screen.getByRole('button', { name: /发送消息/i })
      expect(sendButton).toBeDisabled()
    })
  })

  it('应该显示清空对话按钮', async () => {
    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /清空对话/i })).toBeInTheDocument()
    })
  })

  it('应该能够点击深度思考按钮', async () => {
    const user = userEvent.setup()

    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /深度思考/i })).toBeInTheDocument()
    })

    const deepThinkButton = screen.getByRole('button', { name: /深度思考/i })
    await user.click(deepThinkButton)

    expect(deepThinkButton).toHaveClass('bg-purple-100')
  })

  it('应该显示日历链接', async () => {
    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByTitle('日历管理')).toBeInTheDocument()
    })
  })

  it('应该显示聊天历史链接', async () => {
    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByTitle('查看聊天记录')).toBeInTheDocument()
    })
  })

  it('应该显示智能时间助手按钮', async () => {
    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByTitle('智能时间助手')).toBeInTheDocument()
    })
  })

  it('点击智能时间助手应该显示时间输入面板', async () => {
    const user = userEvent.setup()

    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByTitle('智能时间助手')).toBeInTheDocument()
    })

    const timeHelperButton = screen.getByTitle('智能时间助手')
    await user.click(timeHelperButton)

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/描述你的任务/i)).toBeInTheDocument()
    })
  })

  it('应该能够发送消息并显示用户输入', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { configs: [] } }),
    } as Response)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: {
          response: 'AI 回复内容',
          messageId: 'msg-123',
        },
      }),
    } as Response)

    render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')
    await user.type(input, '你好')

    const sendButton = screen.getByRole('button', { name: /发送消息/i })
    await user.click(sendButton)

    await waitFor(() => {
      expect(screen.getByText('你好')).toBeInTheDocument()
    })
  })

  it('renders desktop density with context inspector', async () => {
    render(<ChatInterface density="desktop" initialTaskId="task-1" initialTaskTitle="桌面端 UI 优化" />)

    await waitFor(() => {
      expect(screen.getByText('Agent Console')).toBeInTheDocument()
    })

    expect(screen.getByText('上下文检查器')).toBeInTheDocument()
    expect(screen.getAllByText('桌面端 UI 优化').length).toBeGreaterThan(0)
  })

  it('focuses input when focusSignal changes', async () => {
    const { rerender } = render(<ChatInterface focusSignal={0} />)

    await waitFor(() => {
      expect(screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')).toBeInTheDocument()
    })

    rerender(<ChatInterface focusSignal={1} />)

    expect(screen.getByPlaceholderText('输入 "@" 唤起常用语，或粘贴代码快速提问')).toHaveFocus()
  })

  it('renders with overflow-hidden to prevent document scroll', async () => {
    const { container } = render(<ChatInterface />)

    await waitFor(() => {
      expect(screen.getByText('矩时智能助手')).toBeInTheDocument()
    })

    const outerDiv = container.firstElementChild as HTMLElement
    expect(outerDiv.className).toContain('overflow-hidden')
    expect(outerDiv.className).toContain('min-h-0')
  })
})
