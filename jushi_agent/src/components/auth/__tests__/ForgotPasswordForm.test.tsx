import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgotPasswordForm } from '../ForgotPasswordForm'

global.fetch = jest.fn()

describe('ForgotPasswordForm', () => {
  const mockOnSuccess = jest.fn()
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该渲染忘记密码表单', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByText('忘记密码')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入注册时的邮箱')).toBeInTheDocument()
  })

  it('应该显示发送重置链接按钮', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByText('发送重置链接')).toBeInTheDocument()
  })

  it('应该允许用户输入邮箱', async () => {
    const user = userEvent.setup()

    render(<ForgotPasswordForm />)

    const emailInput = screen.getByPlaceholderText('请输入注册时的邮箱')
    await user.type(emailInput, 'test@example.com')

    expect(emailInput).toHaveValue('test@example.com')
  })

  it('应该在空邮箱时显示错误', async () => {
    const user = userEvent.setup()

    render(<ForgotPasswordForm />)

    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText('请输入邮箱地址')).toBeInTheDocument()
    })
  })

  it('应该成功发送重置链接', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { resetUrl: 'https://example.com/reset?token=abc' },
      }),
    } as Response)

    render(<ForgotPasswordForm onSuccess={mockOnSuccess} />)

    await user.type(screen.getByPlaceholderText('请输入注册时的邮箱'), 'test@example.com')
    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText(/重置链接已生成/)).toBeInTheDocument()
    })

    expect(mockOnSuccess).toHaveBeenCalledWith('https://example.com/reset?token=abc')
  })

  it('应该处理发送失败', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: false,
        error: '邮箱不存在',
      }),
    } as Response)

    render(<ForgotPasswordForm />)

    await user.type(screen.getByPlaceholderText('请输入注册时的邮箱'), 'nonexistent@example.com')
    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText('邮箱不存在')).toBeInTheDocument()
    })
  })

  it('应该处理网络错误', async () => {
    const user = userEvent.setup()

    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<ForgotPasswordForm />)

    await user.type(screen.getByPlaceholderText('请输入注册时的邮箱'), 'test@example.com')
    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText('发送重置链接时发生错误')).toBeInTheDocument()
    })
  })

  it('应该显示返回登录链接', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByText('返回登录')).toBeInTheDocument()
  })

  it('成功后应该显示重置链接（开发模式）', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { resetUrl: 'https://example.com/reset?token=abc123' },
      }),
    } as Response)

    render(<ForgotPasswordForm />)

    await user.type(screen.getByPlaceholderText('请输入注册时的邮箱'), 'test@example.com')
    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText(/重置链接（开发模式）/)).toBeInTheDocument()
    })
  })
})
