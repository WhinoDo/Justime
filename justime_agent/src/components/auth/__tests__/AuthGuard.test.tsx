import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthGuard } from '../AuthGuard'
import { UserRole } from '@/types/auth'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}))

import { useAuth } from '@/hooks/useAuth'

describe('AuthGuard', () => {
  const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('应该显示加载状态', () => {
    mockUseAuth.mockReturnValue({
      isLoading: true,
      isAuthenticated: false,
      user: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      updateUser: jest.fn(),
      refreshUser: jest.fn(),
      checkAuth: jest.fn(),
    })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('正在检查登录状态...')).toBeInTheDocument()
  })

  it('应该在已认证时显示子内容', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      user: { id: '1', email: 'test@example.com', role: UserRole.USER, username: 'test', displayName: 'Test', isEmailVerified: true, profile: { name: 'Test' } },
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      updateUser: jest.fn(),
      refreshUser: jest.fn(),
      checkAuth: jest.fn(),
    })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('应该在未认证且showLoginPrompt=true且redirectTo为空时显示登录提示', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      updateUser: jest.fn(),
      refreshUser: jest.fn(),
      checkAuth: jest.fn(),
    })

    render(
      <AuthGuard redirectTo="" showLoginPrompt={true}>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('需要登录')).toBeInTheDocument()
    expect(screen.getByText('立即登录')).toBeInTheDocument()
    expect(screen.getByText('注册账户')).toBeInTheDocument()
  })

  it('应该在未认证时显示自定义fallback', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      updateUser: jest.fn(),
      refreshUser: jest.fn(),
      checkAuth: jest.fn(),
    })

    render(
      <AuthGuard fallback={<div>Custom Fallback</div>}>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Custom Fallback')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('应该在requireAuth=false时始终显示内容', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      updateUser: jest.fn(),
      refreshUser: jest.fn(),
      checkAuth: jest.fn(),
    })

    render(
      <AuthGuard requireAuth={false}>
        <div>Public Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Public Content')).toBeInTheDocument()
  })

  it('应该在未认证且无fallback时显示重定向提示', () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPassword: jest.fn(),
      updateUser: jest.fn(),
      refreshUser: jest.fn(),
      checkAuth: jest.fn(),
    })

    render(
      <AuthGuard showLoginPrompt={false}>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('正在重定向到登录页面...')).toBeInTheDocument()
  })
})
