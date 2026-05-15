import { renderHook, act } from '@testing-library/react'
import { usePWAInstall } from '../usePWAInstall'

describe('usePWAInstall', () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      writable: true,
      value: true,
    })
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  describe('初始状态', () => {
    it('应该返回正确的初始状态', () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: false })

      const { result } = renderHook(() => usePWAInstall())

      expect(result.current.canInstall).toBe(false)
      expect(result.current.isInstalled).toBe(false)
    })

    it('已安装时应该设置isInstalled', () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: true })

      const { result } = renderHook(() => usePWAInstall())

      expect(result.current.isInstalled).toBe(true)
    })
  })

  describe('网络状态', () => {
    it('应该响应online事件', () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: false })

      const { result } = renderHook(() => usePWAInstall())

      expect(result.current.isOffline).toBe(false)

      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false,
      })

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })

      expect(result.current.isOffline).toBe(true)

      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: true,
      })

      act(() => {
        window.dispatchEvent(new Event('online'))
      })

      expect(result.current.isOffline).toBe(false)
    })

    it('应该响应offline事件', () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: false })

      const { result } = renderHook(() => usePWAInstall())

      expect(result.current.isOffline).toBe(false)

      Object.defineProperty(window.navigator, 'onLine', {
        writable: true,
        value: false,
      })

      act(() => {
        window.dispatchEvent(new Event('offline'))
      })

      expect(result.current.isOffline).toBe(true)
    })
  })

  describe('install方法', () => {
    it('没有installPrompt时应该返回false', async () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: false })

      const { result } = renderHook(() => usePWAInstall())

      let installResult: boolean = false
      await act(async () => {
        installResult = await result.current.install()
      })

      expect(installResult).toBe(false)
    })
  })

  describe('清理', () => {
    it('卸载时应该移除事件监听器', () => {
      window.matchMedia = jest.fn().mockReturnValue({ matches: false })

      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = renderHook(() => usePWAInstall())

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalled()
    })
  })
})
