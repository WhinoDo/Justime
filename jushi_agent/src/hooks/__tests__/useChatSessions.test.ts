import { renderHook, waitFor, act } from '@testing-library/react'
import { useChatSessions } from '../useChatSessions'

global.fetch = jest.fn()

const mockSessions = [
  { _id: '1', title: 'Session 1', updatedAt: '2024-01-01', preview: 'Preview 1' },
  { _id: '2', title: 'Session 2', updatedAt: '2024-01-02', preview: 'Preview 2' },
]

describe('useChatSessions', () => {
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    mockFetch.mockClear()
  })

  describe('加载会话列表', () => {
    it('没有userId时不应该发起请求', async () => {
      const { result } = renderHook(() => useChatSessions())

      await waitFor(() => {
        expect(result.current.sessions).toEqual([])
        expect(result.current.loading).toBe(false)
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('有userId时应该加载会话列表', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      } as Response)

      const { result } = renderHook(() => useChatSessions({ userId: 'user1' }))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.sessions).toEqual(mockSessions)
      expect(result.current.error).toBeNull()
    })

    it('加载失败时应该设置错误', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as Response)

      const { result } = renderHook(() => useChatSessions({ userId: 'user1' }))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Failed to load sessions')
    })

    it('网络错误时应该处理异常', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useChatSessions({ userId: 'user1' }))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('An error occurred while loading sessions')
      expect(result.current.sessions).toEqual([])
      consoleErrorSpy.mockRestore()
    })
  })

  describe('自动选择最新会话', () => {
    it('autoSelectLatest=true时应该调用onAutoSelect', async () => {
      const onAutoSelect = jest.fn()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      } as Response)

      renderHook(() => useChatSessions({
        userId: 'user1',
        autoSelectLatest: true,
        currentSessionId: null,
        onAutoSelect,
      }))

      await waitFor(() => {
        expect(onAutoSelect).toHaveBeenCalledWith('1')
      })
    })

    it('已有currentSessionId时不应该自动选择', async () => {
      const onAutoSelect = jest.fn()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      } as Response)

      renderHook(() => useChatSessions({
        userId: 'user1',
        autoSelectLatest: true,
        currentSessionId: 'existing-id',
        onAutoSelect,
      }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      expect(onAutoSelect).not.toHaveBeenCalled()
    })

    it('会话列表为空时不应该自动选择', async () => {
      const onAutoSelect = jest.fn()

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: [] }),
      } as Response)

      renderHook(() => useChatSessions({
        userId: 'user1',
        autoSelectLatest: true,
        currentSessionId: null,
        onAutoSelect,
      }))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      expect(onAutoSelect).not.toHaveBeenCalled()
    })
  })

  describe('reload', () => {
    it('应该能够重新加载会话列表', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      } as Response)

      const { result } = renderHook(() => useChatSessions({ userId: 'user1' }))

      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })

      const newSessions = [
        { _id: '3', title: 'New Session', updatedAt: '2024-01-03', preview: 'New' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: newSessions }),
      } as Response)

      await act(async () => {
        await result.current.reload()
      })

      expect(result.current.sessions).toEqual(newSessions)
    })
  })

  describe('userId变化', () => {
    it('userId变化时应该重新加载', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      } as Response)

      const { result, rerender } = renderHook(
        ({ userId }) => useChatSessions({ userId }),
        { initialProps: { userId: 'user1' } }
      )

      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })

      const newUserSessions = [
        { _id: '4', title: 'User2 Session', updatedAt: '2024-01-04', preview: 'User2' },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: newUserSessions }),
      } as Response)

      rerender({ userId: 'user2' })

      await waitFor(() => {
        expect(result.current.sessions).toEqual(newUserSessions)
      })
    })

    it('userId变为undefined时应该清空会话列表', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      } as Response)

      const { result, rerender } = renderHook(
        ({ userId }) => useChatSessions({ userId }),
        { initialProps: { userId: 'user1' as string | undefined } }
      )

      await waitFor(() => {
        expect(result.current.sessions).toEqual(mockSessions)
      })

      rerender({ userId: undefined })

      await waitFor(() => {
        expect(result.current.sessions).toEqual([])
        expect(result.current.error).toBeNull()
      })
    })
  })
})
