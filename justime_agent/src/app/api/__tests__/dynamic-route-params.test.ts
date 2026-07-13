import type { NextRequest } from 'next/server'

import {
  DELETE as deleteApiKey,
  PUT as updateApiKey,
} from '@/app/api/admin/apikeys/[keyId]/route'
import {
  DELETE as deleteModel,
  PUT as updateModel,
} from '@/app/api/admin/models/[modelId]/route'
import { PUT as updateUserModels } from '@/app/api/admin/users/[userId]/models/route'
import { PUT as updateUserRole } from '@/app/api/admin/users/[userId]/role/route'
import { DELETE as deleteUser } from '@/app/api/admin/users/[userId]/route'
import { PUT as updateUserStatus } from '@/app/api/admin/users/[userId]/status/route'
import { PUT as activateLlmConfig } from '@/app/api/auth/llm-configs/[id]/active/route'
import {
  DELETE as deleteLlmConfig,
  PUT as updateLlmConfig,
} from '@/app/api/auth/llm-configs/[id]/route'
import { POST as testLlmConfig } from '@/app/api/auth/llm-configs/[id]/test/route'
import {
  DELETE as deleteCalendarEvent,
  GET as getCalendarEvent,
  PUT as updateCalendarEvent,
} from '@/app/api/calendar/events/[id]/route'
import { GET as getYoutubeSummaryJob } from '@/app/api/calendar/events/[id]/youtube-summary/jobs/[jobId]/route'
import { POST as createYoutubeSummaryJob } from '@/app/api/calendar/events/[id]/youtube-summary/jobs/route'
import { GET as getChatMessages } from '@/app/api/chat/sessions/[sessionId]/messages/route'

const mockProxyToBackend = jest.fn()
const mockProxyWithAuth = jest.fn()
const mockCreateErrorResponse = jest.fn()

jest.mock('@/lib/api/proxy', () => ({
  proxyToBackend: (...args: unknown[]) => mockProxyToBackend(...args),
  proxyWithAuth: (...args: unknown[]) => mockProxyWithAuth(...args),
  createErrorResponse: (...args: unknown[]) => mockCreateErrorResponse(...args),
}))

type DynamicRouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<unknown>

function makeRequest(method: string, body: Record<string, unknown> = {}) {
  return {
    method,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as NextRequest
}

describe('Next 15 dynamic BFF route params', () => {
  const proxyResponse = { proxied: true }

  beforeEach(() => {
    mockProxyToBackend.mockReset()
    mockProxyWithAuth.mockReset()
    mockCreateErrorResponse.mockReset()
    mockProxyToBackend.mockResolvedValue(proxyResponse)
    mockProxyWithAuth.mockResolvedValue(proxyResponse)
  })

  it.each([
    ['update API key', updateApiKey, 'PUT', { keyId: 'key-1' }, '/admin/apikeys/key-1', true],
    ['delete API key', deleteApiKey, 'DELETE', { keyId: 'key-1' }, '/admin/apikeys/key-1', false],
    ['update model', updateModel, 'PUT', { modelId: 'model-1' }, '/admin/models/model-1', true],
    ['delete model', deleteModel, 'DELETE', { modelId: 'model-1' }, '/admin/models/model-1', false],
    ['update user models', updateUserModels, 'PUT', { userId: 'user-1' }, '/admin/users/user-1/models', true],
    ['update user role', updateUserRole, 'PUT', { userId: 'user-1' }, '/admin/users/user-1/role', true],
    ['delete user', deleteUser, 'DELETE', { userId: 'user-1' }, '/admin/users/user-1', false],
    ['update user status', updateUserStatus, 'PUT', { userId: 'user-1' }, '/admin/users/user-1/status', true],
    ['update LLM config', updateLlmConfig, 'PUT', { id: 'config-1' }, '/auth/llm-configs/config-1', true],
    ['delete LLM config', deleteLlmConfig, 'DELETE', { id: 'config-1' }, '/auth/llm-configs/config-1', false],
    ['activate LLM config', activateLlmConfig, 'PUT', { id: 'config-1' }, '/auth/llm-configs/config-1/active', false],
    ['test LLM config', testLlmConfig, 'POST', { id: 'config-1' }, '/auth/llm-configs/config-1/test', false],
    [
      'create YouTube summary job',
      createYoutubeSummaryJob,
      'POST',
      { id: 'event-1' },
      '/calendar/events/event-1/youtube-summary/jobs',
      true,
    ],
    [
      'get YouTube summary job',
      getYoutubeSummaryJob,
      'GET',
      { id: 'event-1', jobId: 'job-1' },
      '/calendar/events/event-1/youtube-summary/jobs/job-1',
      false,
    ],
  ] as const)(
    'awaits params and preserves the authenticated proxy contract for %s',
    async (_label, handler, method, params, endpoint, forwardsBody) => {
      const body = { marker: endpoint }
      const request = makeRequest(method, body)

      const response = await (handler as DynamicRouteHandler)(request, {
        params: Promise.resolve(params),
      })

      expect(mockProxyWithAuth).toHaveBeenCalledTimes(1)
      const [proxiedRequest, proxiedEndpoint, options] = mockProxyWithAuth.mock.calls[0]
      expect(proxiedRequest).toBe(request)
      expect(proxiedEndpoint).toBe(endpoint)
      expect(options).toEqual(expect.objectContaining({ method }))
      if (forwardsBody) {
        expect(options.body).toBe(body)
      } else {
        expect(options).not.toHaveProperty('body')
      }
      if (_label === 'get YouTube summary job') {
        expect(options.cache).toBe('no-store')
      }
      expect(response).toBe(proxyResponse)
    }
  )

  it.each([
    ['get calendar event', getCalendarEvent, 'GET', { id: 'event-1' }, '/calendar/events/event-1', undefined],
    [
      'delete calendar event',
      deleteCalendarEvent,
      'DELETE',
      { id: 'event-1' },
      '/calendar/events/event-1',
      { method: 'DELETE' },
    ],
    [
      'get chat messages',
      getChatMessages,
      'GET',
      { sessionId: 'session-1' },
      '/chat/sessions/session-1/messages',
      undefined,
    ],
  ] as const)(
    'awaits params and preserves the direct proxy contract for %s',
    async (_label, handler, method, params, endpoint, options) => {
      const request = makeRequest(method)

      const response = await (handler as DynamicRouteHandler)(request, {
        params: Promise.resolve(params),
      })

      if (options) {
        expect(mockProxyToBackend).toHaveBeenCalledWith(request, endpoint, options)
      } else {
        expect(mockProxyToBackend).toHaveBeenCalledWith(request, endpoint)
      }
      expect(response).toBe(proxyResponse)
    }
  )

  it('awaits calendar params while preserving update validation and payload sanitization', async () => {
    const body = {
      title: 'Planning',
      start: '2026-07-13T09:00:00.000Z',
      end: '2026-07-13T10:00:00.000Z',
      userId: 'must-not-be-forwarded',
    }
    const request = makeRequest('PUT', body)

    const response = await (updateCalendarEvent as DynamicRouteHandler)(request, {
      params: Promise.resolve({ id: 'event-1' }),
    })

    expect(mockProxyToBackend).toHaveBeenCalledWith(request, '/calendar/events/event-1', {
      method: 'PUT',
      body: {
        title: 'Planning',
        start: '2026-07-13T09:00:00.000Z',
        end: '2026-07-13T10:00:00.000Z',
      },
    })
    expect(mockCreateErrorResponse).not.toHaveBeenCalled()
    expect(response).toBe(proxyResponse)
  })
})
