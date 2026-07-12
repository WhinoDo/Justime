import { act, renderHook, waitFor } from '@testing-library/react'
import { useTaskProcesses, type TaskProcessListQuery } from '../useTaskProcesses'
import type { TaskProcess } from '@/types/taskProcess'

const backendTask: TaskProcess = {
  id: 'task-backend-result',
  userId: 'user-1',
  title: '后端返回任务',
  description: '用于验证服务端结果不被本地过滤',
  goal: '保持后端结果集原样',
  category: 'learning',
  tags: [],
  status: 'active',
  phase: 'during',
  priority: 'high',
  progress: 0.5,
  progress_source: 'evidence',
  actual_hours: 2,
  milestones: [],
  blockers: [],
  ai_suggestions: [],
  related_chat_session_ids: [],
  related_calendar_event_ids: [],
  evidence_count: 1,
  knowledge_output_count: 0,
}

function listResponse() {
  return {
    ok: true,
    json: async () => ({
      success: true,
      data: {
        items: [backendTask],
        total: 23,
        page: 2,
        page_size: 5,
        total_pages: 5,
      },
    }),
  } as Response
}

function requestUrl(callIndex = 0) {
  return new URL((fetch as jest.MockedFunction<typeof fetch>).mock.calls[callIndex][0] as string, 'http://localhost')
}

describe('useTaskProcesses', () => {
  const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockReset()
    mockFetch.mockResolvedValue(listResponse())
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('sends filters, sorting, and pagination while preserving backend items and metadata', async () => {
    const query: TaskProcessListQuery = {
      phase: 'during',
      category: 'writing',
      priority: 'high',
      sort_by: 'progress',
      sort_order: 'asc',
      page: 2,
      page_size: 5,
    }
    const { result } = renderHook(() => useTaskProcesses(query))

    await waitFor(() => expect(result.current.loading).toBe(false))

    const url = requestUrl()
    expect(url.pathname).toBe('/api/task-processes')
    expect(url.searchParams.get('phase')).toBe('during')
    expect(url.searchParams.get('category')).toBe('writing')
    expect(url.searchParams.get('priority')).toBe('high')
    expect(url.searchParams.get('sort_by')).toBe('progress')
    expect(url.searchParams.get('sort_order')).toBe('asc')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('page_size')).toBe('5')

    expect(result.current.tasks).toEqual([backendTask])
    expect(result.current.total).toBe(23)
    expect(result.current.page).toBe(2)
    expect(result.current.pageSize).toBe(5)
    expect(result.current.totalPages).toBe(5)
  })

  it('waits 300ms before sending a changed search term', async () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ search }) => useTaskProcesses({ search }),
      { initialProps: { search: '' } },
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.loading).toBe(false)
    mockFetch.mockClear()

    rerender({ search: '  roadmap  ' })
    expect(mockFetch).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(mockFetch).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(1)
      await Promise.resolve()
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(requestUrl().searchParams.get('search')).toBe('roadmap')
  })

  it('debounces a changed search and its page reset as one request', async () => {
    jest.useFakeTimers()
    const { result, rerender } = renderHook(
      (query: TaskProcessListQuery) => useTaskProcesses(query),
      {
        initialProps: {
          search: 'old term',
          page: 2,
          page_size: 12,
        },
      },
    )

    await act(async () => {
      await Promise.resolve()
    })
    expect(result.current.loading).toBe(false)
    mockFetch.mockClear()

    rerender({ search: '  new term  ', page: 1, page_size: 12 })
    expect(mockFetch).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(299)
    })
    expect(mockFetch).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(1)
      await Promise.resolve()
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = requestUrl()
    expect(url.searchParams.get('search')).toBe('new term')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.get('page_size')).toBe('12')
  })

  it('requests page-only changes immediately when search is unchanged', async () => {
    const { result, rerender } = renderHook(
      (query: TaskProcessListQuery) => useTaskProcesses(query),
      {
        initialProps: {
          search: 'roadmap',
          page: 1,
          page_size: 12,
        },
      },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    mockFetch.mockClear()

    rerender({ search: 'roadmap', page: 2, page_size: 12 })

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const url = requestUrl()
    expect(url.searchParams.get('search')).toBe('roadmap')
    expect(url.searchParams.get('page')).toBe('2')
  })
})
