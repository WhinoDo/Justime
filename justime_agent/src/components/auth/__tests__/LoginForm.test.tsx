import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginForm } from '../LoginForm'

const mockLogin = jest.fn()
const mockPush = jest.fn()

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: mockLogin,
    isLoading: false,
  }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

describe('LoginForm', () => {
  beforeEach(() => {
    mockLogin.mockClear()
    mockPush.mockClear()
  })

  it('应该渲染登录表单', () => {
    render(<LoginForm />)

    expect(screen.getByText('登录账户')).toBeInTheDocument()
    expect(screen.getByText('欢迎回来，请登录您的账户')).toBeInTheDocument()
    expect(screen.getByLabelText('用户名或邮箱 *')).toBeInTheDocument()
    expect(screen.getByLabelText('密码 *')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /登录/ })).toBeInTheDocument()
  })

  it('应该显示必填字段标记', () => {
    render(<LoginForm />)

    expect(screen.getByText('用户名或邮箱 *')).toBeInTheDocument()
    expect(screen.getByText('密码 *')).toBeInTheDocument()
  })

  it('应该显示记住我复选框', () => {
    render(<LoginForm />)

    expect(screen.getByText('记住我（30天内免登录）')).toBeInTheDocument()
  })

  it('空表单提交时应该显示错误', async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    const submitButton = screen.getByRole('button', { name: /登录/ })
    await user.click(submitButton)

    expect(screen.getByText('请填写用户名/邮箱和密码')).toBeInTheDocument()
  })

  it('登录成功时应该调用onSuccess', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    const mockUser = { id: '1', displayName: 'Test User' }

    mockLogin.mockResolvedValueOnce({ success: true, user: mockUser })

    render(<LoginForm onSuccess={onSuccess} />)

    await user.type(screen.getByLabelText('用户名或邮箱 *'), 'testuser')
    await user.type(screen.getByLabelText('密码 *'), 'password123')

    const submitButton = screen.getByRole('button', { name: /登录/ })
    await user.click(submitButton)

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockUser)
    })
  })

  it('登录成功时应该显示成功消息', async () => {
    const user = userEvent.setup()

    mockLogin.mockResolvedValueOnce({ success: true, user: { id: '1' } })

    render(<LoginForm />)

    await user.type(screen.getByLabelText('用户名或邮箱 *'), 'testuser')
    await user.type(screen.getByLabelText('密码 *'), 'password123')

    const submitButton = screen.getByRole('button', { name: /登录/ })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('登录成功！')).toBeInTheDocument()
    })
  })

  it('登录失败时应该显示错误消息', async () => {
    const user = userEvent.setup()

    mockLogin.mockResolvedValueOnce({ success: false, error: '用户名或密码错误' })

    render(<LoginForm />)

    await user.type(screen.getByLabelText('用户名或邮箱 *'), 'testuser')
    await user.type(screen.getByLabelText('密码 *'), 'wrongpassword')

    const submitButton = screen.getByRole('button', { name: /登录/ })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument()
    })
  })

  it('点击忘记密码应该跳转', async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    const forgotLink = screen.getByText('忘记密码？')
    await user.click(forgotLink)

    expect(mockPush).toHaveBeenCalledWith('/auth/forgot-password')
  })

  it('点击立即注册应该调用onSwitchToRegister', async () => {
    const user = userEvent.setup()
    const onSwitchToRegister = jest.fn()

    render(<LoginForm onSwitchToRegister={onSwitchToRegister} />)

    const registerLink = screen.getByText('立即注册')
    await user.click(registerLink)

    expect(onSwitchToRegister).toHaveBeenCalled()
  })

  it('输入时应该清除错误信息', async () => {
    const user = userEvent.setup()

    render(<LoginForm />)

    const submitButton = screen.getByRole('button', { name: /登录/ })
    await user.click(submitButton)

    expect(screen.getByText('请填写用户名/邮箱和密码')).toBeInTheDocument()

    await user.type(screen.getByLabelText('用户名或邮箱 *'), 'test')

    expect(screen.queryByText('请填写用户名/邮箱和密码')).not.toBeInTheDocument()
  })

  it('提交时应该禁用表单', async () => {
    const user = userEvent.setup()

    mockLogin.mockImplementationOnce(() => new Promise(resolve => {
      setTimeout(() => resolve({ success: true, user: { id: '1' } }), 100)
    }))

    render(<LoginForm />)

    await user.type(screen.getByLabelText('用户名或邮箱 *'), 'testuser')
    await user.type(screen.getByLabelText('密码 *'), 'password123')

    const submitButton = screen.getByRole('button', { name: /登录/ })
    await user.click(submitButton)

    expect(screen.getByLabelText('用户名或邮箱 *')).toBeDisabled()
    expect(screen.getByLabelText('密码 *')).toBeDisabled()
  })

  it('登录成功且有redirectTo时应该重定向', async () => {
    const user = userEvent.setup()
    const originalLocation = window.location
    delete (window as any).location
    ;(window as any).location = { href: '' }

    mockLogin.mockResolvedValueOnce({ success: true, user: { id: '1' } })

    render(<LoginForm redirectTo="/dashboard" />)

    await user.type(screen.getByLabelText('用户名或邮箱 *'), 'testuser')
    await user.type(screen.getByLabelText('密码 *'), 'password123')

    const submitButton = screen.getByRole('button', { name: /登录/ })
    await user.click(submitButton)

    await waitFor(() => {
      expect(window.location.href).toBe('/dashboard')
    }, { timeout: 3000 })

    ;(window as any).location = originalLocation
  })
})
