import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RegisterForm } from '../RegisterForm'

const mockRegister = jest.fn()

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    isLoading: false,
  }),
}))

global.fetch = jest.fn()

describe('RegisterForm', () => {
  const mockOnSuccess = jest.fn()
  const mockOnSwitchToLogin = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockRegister.mockResolvedValue({ success: false, error: '注册失败' })
  })

  it('应该渲染注册表单', () => {
    render(<RegisterForm />)

    expect(screen.getByText('创建账户')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入邮箱地址')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('请输入密码（至少6个字符）')).toBeInTheDocument()
  })

  it('应该显示必填字段标记', () => {
    render(<RegisterForm />)

    expect(screen.getByText('邮箱地址 *')).toBeInTheDocument()
    expect(screen.getByText('密码 *')).toBeInTheDocument()
    expect(screen.getByText('确认密码 *')).toBeInTheDocument()
  })

  it('应该允许用户输入邮箱', async () => {
    const user = userEvent.setup()

    render(<RegisterForm />)

    const emailInput = screen.getByPlaceholderText('请输入邮箱地址')
    await user.type(emailInput, 'test@example.com')

    expect(emailInput).toHaveValue('test@example.com')
  })

  it('应该在密码小于6个字符时显示错误', async () => {
    const user = userEvent.setup()

    render(<RegisterForm />)

    await user.type(screen.getByPlaceholderText('请输入邮箱地址'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('请输入密码（至少6个字符）'), '123')
    await user.type(screen.getByPlaceholderText('请再次输入密码'), '123')

    await user.click(screen.getByText('注册账户'))

    await waitFor(() => {
      expect(screen.getByText('密码至少需要6个字符')).toBeInTheDocument()
    })
  })

  it('应该在密码不匹配时显示错误', async () => {
    const user = userEvent.setup()

    render(<RegisterForm />)

    await user.type(screen.getByPlaceholderText('请输入邮箱地址'), 'test@example.com')
    await user.type(screen.getByPlaceholderText('请输入密码（至少6个字符）'), 'password123')
    await user.type(screen.getByPlaceholderText('请再次输入密码'), 'password456')

    await user.click(screen.getByText('注册账户'))

    await waitFor(() => {
      expect(screen.getByText('两次输入的密码不一致')).toBeInTheDocument()
    })
  })

  it('应该在邮箱格式无效时显示错误', async () => {
    const user = userEvent.setup()

    render(<RegisterForm />)

    await user.type(screen.getByPlaceholderText('请输入邮箱地址'), 'not-an-email')
    await user.type(screen.getByPlaceholderText('请输入密码（至少6个字符）'), 'password123')
    await user.type(screen.getByPlaceholderText('请再次输入密码'), 'password123')

    const form = screen.getByPlaceholderText('请输入邮箱地址').closest('form')!
    fireEvent.submit(form)

    await waitFor(() => {
      expect(screen.getByText('请输入有效的邮箱地址')).toBeInTheDocument()
    })
  })

  it('应该在空邮箱时显示错误', async () => {
    const user = userEvent.setup()

    render(<RegisterForm />)

    await user.click(screen.getByText('注册账户'))

    await waitFor(() => {
      expect(screen.getByText('请输入邮箱地址')).toBeInTheDocument()
    })
  })

  it('应该显示切换登录按钮', () => {
    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />)

    expect(screen.getByText('立即登录')).toBeInTheDocument()
  })

  it('点击切换登录按钮应该调用回调', async () => {
    const user = userEvent.setup()

    render(<RegisterForm onSwitchToLogin={mockOnSwitchToLogin} />)

    await user.click(screen.getByText('立即登录'))

    expect(mockOnSwitchToLogin).toHaveBeenCalled()
  })

  it('应该显示可选字段', () => {
    render(<RegisterForm />)

    expect(screen.getByText('用户名（可选）')).toBeInTheDocument()
    expect(screen.getByText('显示名称（可选）')).toBeInTheDocument()
    expect(screen.getByText('手机号（可选）')).toBeInTheDocument()
  })
})
