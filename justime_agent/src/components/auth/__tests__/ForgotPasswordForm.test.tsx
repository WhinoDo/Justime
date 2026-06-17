import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ForgotPasswordForm } from '../ForgotPasswordForm'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}))

global.fetch = jest.fn()

describe('ForgotPasswordForm', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders forgot password form', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByText('忘记密码')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入注册时使用的邮箱')).toBeInTheDocument()
  })

  it('allows user to input email', async () => {
    const user = userEvent.setup()

    render(<ForgotPasswordForm />)

    const emailInput = screen.getByPlaceholderText('请输入注册时使用的邮箱')
    await user.type(emailInput, 'test@example.com')

    expect(emailInput).toHaveValue('test@example.com')
  })

  it('shows error for empty email', async () => {
    const user = userEvent.setup()

    render(<ForgotPasswordForm />)

    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText('请输入邮箱地址')).toBeInTheDocument()
    })
  })

  it('handles successful request', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: true,
        message: '如果该邮箱已注册，您将收到密码重置邮件',
      }),
    } as Response)

    render(<ForgotPasswordForm />)

    await user.type(screen.getByPlaceholderText('请输入注册时使用的邮箱'), 'test@example.com')
    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText('如果该邮箱已注册，您将收到密码重置邮件')).toBeInTheDocument()
    })
  })

  it('handles request failure', async () => {
    const user = userEvent.setup()

    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve({
        success: false,
        error: '邮箱不存在',
      }),
    } as Response)

    render(<ForgotPasswordForm />)

    await user.type(screen.getByPlaceholderText('请输入注册时使用的邮箱'), 'nonexistent@example.com')
    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText('邮箱不存在')).toBeInTheDocument()
    })
  })

  it('handles network error', async () => {
    const user = userEvent.setup()

    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<ForgotPasswordForm />)

    await user.type(screen.getByPlaceholderText('请输入注册时使用的邮箱'), 'test@example.com')
    await user.click(screen.getByText('发送重置链接'))

    await waitFor(() => {
      expect(screen.getByText('发送请求时发生错误，请稍后重试')).toBeInTheDocument()
    })
  })

  it('shows back to login action', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByText('返回登录')).toBeInTheDocument()
  })
})
