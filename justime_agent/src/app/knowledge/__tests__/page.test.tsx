import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { username: 'TestUser', role: 'user' },
    isLoading: false,
    isAuthenticated: true,
  })),
}))

jest.mock('@/hooks/useDesktopRuntime', () => ({
  useDesktopRuntime: jest.fn(() => ({ isDesktop: true })),
}))

const mockToast = jest.fn()
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

jest.mock('@/components/ui/JustimeBackground', () => ({
  JustimeBackground: () => <div data-testid="justime-background" />,
}))

jest.mock('@/components/knowledge/MarkdownPreview', () => ({
  MarkdownPreview: ({ content }: { content: string }) => <div>{content}</div>,
}))

import KnowledgeBasePage from '../page'

type JsonPayload = Record<string, unknown>

const mockFetch = jest.fn()

function jsonResponse(payload: JsonPayload, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: jest.fn().mockResolvedValue(payload),
  })
}

function availability(
  status: 'ready' | 'degraded' | 'unavailable' | 'error',
  options: { retryable?: boolean; errorCode?: string | null } = {}
) {
  return {
    mode: status === 'unavailable' ? 'unavailable' : 'cloud',
    provider: status === 'unavailable' ? 'none' : 'notebooklm',
    status,
    retryable: options.retryable ?? false,
    error_code: options.errorCode ?? null,
  }
}

function rebuildPayload(
  status: 'ready' | 'degraded' | 'unavailable' | 'error',
  options: { retryable?: boolean; errorCode?: string | null; message?: string } = {}
) {
  return {
    success: false,
    task_id: null,
    status: 'unavailable',
    message: options.message,
    availability: availability(status, options),
  }
}

function setupFetch(rebuildResponse: JsonPayload, files: JsonPayload[] = []) {
  mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/knowledge/files' && !init?.method) {
      return jsonResponse({ success: true, files })
    }
    if (url === '/api/knowledge/rebuild' && init?.method === 'POST') {
      return jsonResponse(rebuildResponse)
    }
    throw new Error(`Unexpected fetch: ${url}`)
  })
}

async function openRebuildStatus() {
  await screen.findByText('Documents (0)')
  await userEvent.click(screen.getByRole('button', { name: '重建索引' }))
}

describe('KnowledgeBasePage RAG availability states', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = mockFetch as unknown as typeof fetch
    global.confirm = jest.fn(() => true)
  })

  it.each([
    ['ready', '服务就绪'],
    ['degraded', '服务受限'],
    ['unavailable', '服务不可用'],
    ['error', '服务异常'],
  ] as const)('renders %s as a distinct accessible state', async (status, label) => {
    setupFetch(rebuildPayload(status))
    render(<KnowledgeBasePage />)

    await openRebuildStatus()

    const statusRegion = await screen.findByRole('status')
    expect(statusRegion).toHaveAttribute('data-provider-status', status)
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('keeps document preview and delete controls usable while the provider is degraded', async () => {
    setupFetch(rebuildPayload('degraded'), [
      { name: 'notes.md', size: 128, modified: 1_700_000_000 },
    ])
    render(<KnowledgeBasePage />)

    await screen.findByText('notes.md')
    expect(screen.getByTitle('预览文档')).toBeEnabled()
    expect(screen.getByTitle('删除文档')).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: '重建索引' }))

    expect(await screen.findByText('服务受限')).toBeInTheDocument()
    expect(screen.getByText('notes.md')).toBeInTheDocument()
  })

  it('does not offer retry when retryable is false', async () => {
    setupFetch(rebuildPayload('unavailable', {
      retryable: false,
      errorCode: 'PROVIDER_NOT_CONFIGURED',
    }))
    render(<KnowledgeBasePage />)

    await openRebuildStatus()

    expect(await screen.findByText('服务不可用')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '重试重建' })).not.toBeInTheDocument()
  })

  it('offers retry only for retryable failures', async () => {
    setupFetch(rebuildPayload('unavailable', {
      retryable: true,
      errorCode: 'PROVIDER_UNAVAILABLE',
    }))
    render(<KnowledgeBasePage />)

    await openRebuildStatus()

    expect(await screen.findByRole('button', { name: '重试重建' })).toBeEnabled()
  })

  it('allows only one pending retry request during rapid repeated interaction', async () => {
    let resolveRetry: ((value: unknown) => void) | undefined
    const pendingRetry = new Promise((resolve) => {
      resolveRetry = resolve
    })
    let rebuildCalls = 0

    mockFetch.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url === '/api/knowledge/files' && !init?.method) {
        return jsonResponse({ success: true, files: [] })
      }
      if (url === '/api/knowledge/rebuild' && init?.method === 'POST') {
        rebuildCalls += 1
        if (rebuildCalls === 1) {
          return jsonResponse(rebuildPayload('unavailable', {
            retryable: true,
            errorCode: 'PROVIDER_UNAVAILABLE',
          }))
        }
        return pendingRetry
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })

    render(<KnowledgeBasePage />)
    await openRebuildStatus()
    const retryButton = await screen.findByRole('button', { name: '重试重建' })

    fireEvent.click(retryButton)
    fireEvent.click(retryButton)

    expect(rebuildCalls).toBe(2)
    await act(async () => {
      resolveRetry?.({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(rebuildPayload('unavailable')),
      })
      await pendingRetry
    })
  })

  it('uses generic safe copy for an unknown error code', async () => {
    setupFetch(rebuildPayload('error', { errorCode: 'INTERNAL_SECRET_DETAIL' }))
    render(<KnowledgeBasePage />)

    await openRebuildStatus()

    expect(await screen.findByText('云端知识服务当前受限，请稍后再试。')).toBeInTheDocument()
    expect(screen.queryByText('INTERNAL_SECRET_DETAIL')).not.toBeInTheDocument()
  })

  it('does not use human message text as the availability authority', async () => {
    setupFetch(rebuildPayload('ready', {
      message: 'provider unavailable and rebuild failed',
    }))
    render(<KnowledgeBasePage />)

    await openRebuildStatus()

    expect(await screen.findByText('服务就绪')).toBeInTheDocument()
    expect(screen.queryByText('服务不可用')).not.toBeInTheDocument()
    expect(screen.queryByText('provider unavailable and rebuild failed')).not.toBeInTheDocument()
  })

  it('falls back to exact top-level structured fields when nested availability is absent', async () => {
    setupFetch({
      success: false,
      task_id: null,
      status: 'unavailable',
      mode: 'cloud',
      provider: 'notebooklm',
      provider_status: 'error',
      retryable: false,
      error_code: 'REBUILD_CANCELLED',
    })
    render(<KnowledgeBasePage />)

    await openRebuildStatus()

    await waitFor(() => expect(screen.getByText('服务异常')).toBeInTheDocument())
    expect(screen.getByText('本次索引重建已取消。')).toBeInTheDocument()
  })
})
