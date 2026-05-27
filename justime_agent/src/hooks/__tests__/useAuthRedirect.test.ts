import { renderHook } from '@testing-library/react'
import { useAuthRedirect } from '../useAuthRedirect'

const mockPush = jest.fn()
const mockReplace = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}))

describe('useAuthRedirect', () => {
  const originalLocation = window.location

  beforeEach(() => {
    mockPush.mockClear()
    mockReplace.mockClear()
    delete (window as any).location
    ;(window as any).location = { href: '' }
  })

  afterEach(() => {
    ;(window as any).location = originalLocation
  })

  describe('重定向逻辑', () => {
    it('isLoading时不应该重定向', () => {
      renderHook(() => useAuthRedirect({
        isLoading: true,
        isAuthenticated: true,
        redirectTo: '/dashboard',
      }))

      expect(mockPush).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
      expect(window.location.href).toBe('')
    })

    it('未认证时不应该重定向', () => {
      renderHook(() => useAuthRedirect({
        isLoading: false,
        isAuthenticated: false,
        redirectTo: '/dashboard',
      }))

      expect(mockPush).not.toHaveBeenCalled()
      expect(mockReplace).not.toHaveBeenCalled()
      expect(window.location.href).toBe('')
    })

    it('认证成功且mode=push时应该使用router.push', () => {
      renderHook(() => useAuthRedirect({
        isLoading: false,
        isAuthenticated: true,
        redirectTo: '/dashboard',
        mode: 'push',
      }))

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('认证成功且mode=replace时应该使用router.replace', () => {
      renderHook(() => useAuthRedirect({
        isLoading: false,
        isAuthenticated: true,
        redirectTo: '/dashboard',
        mode: 'replace',
      }))

      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })

    it('认证成功且mode=href时应该使用window.location.href', () => {
      renderHook(() => useAuthRedirect({
        isLoading: false,
        isAuthenticated: true,
        redirectTo: '/dashboard',
        mode: 'href',
      }))

      expect(window.location.href).toBe('/dashboard')
    })

    it('默认mode为href', () => {
      renderHook(() => useAuthRedirect({
        isLoading: false,
        isAuthenticated: true,
        redirectTo: '/home',
      }))

      expect(window.location.href).toBe('/home')
    })
  })

  describe('状态变化', () => {
    it('从loading变为完成时应该触发重定向', () => {
      const { rerender } = renderHook(
        ({ isLoading }) => useAuthRedirect({
          isLoading,
          isAuthenticated: true,
          redirectTo: '/dashboard',
          mode: 'push',
        }),
        { initialProps: { isLoading: true } }
      )

      expect(mockPush).not.toHaveBeenCalled()

      rerender({ isLoading: false })

      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })

    it('从未认证变为认证时应该触发重定向', () => {
      const { rerender } = renderHook(
        ({ isAuthenticated }) => useAuthRedirect({
          isLoading: false,
          isAuthenticated,
          redirectTo: '/dashboard',
          mode: 'replace',
        }),
        { initialProps: { isAuthenticated: false } }
      )

      expect(mockReplace).not.toHaveBeenCalled()

      rerender({ isAuthenticated: true })

      expect(mockReplace).toHaveBeenCalledWith('/dashboard')
    })
  })

  describe('不同重定向路径', () => {
    it('应该支持不同的重定向路径', () => {
      renderHook(() => useAuthRedirect({
        isLoading: false,
        isAuthenticated: true,
        redirectTo: '/profile/settings',
        mode: 'push',
      }))

      expect(mockPush).toHaveBeenCalledWith('/profile/settings')
    })

    it('应该支持带查询参数的路径', () => {
      renderHook(() => useAuthRedirect({
        isLoading: false,
        isAuthenticated: true,
        redirectTo: '/dashboard?tab=overview',
        mode: 'push',
      }))

      expect(mockPush).toHaveBeenCalledWith('/dashboard?tab=overview')
    })
  })
})
