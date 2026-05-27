import { setNodeEnv } from '@/test-utils/env'

const mockCreateErrorResponse = jest.fn()
const mockProxyWithAuth = jest.fn()

jest.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => ({ jsonArgs: args }),
  },
}))

jest.mock('@/lib/api/config', () => ({
  API_CONFIG: {
    BASE_URL: 'http://backend.local',
    getFullUrl: () => 'http://backend.local/api/v1/chat/',
  },
}))

jest.mock('@/lib/api/proxy', () => ({
  createErrorResponse: (...args: unknown[]) => mockCreateErrorResponse(...args),
  proxyWithAuth: (...args: unknown[]) => mockProxyWithAuth(...args),
}))

describe('POST /api/chat route', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    jest.resetModules()
    mockCreateErrorResponse.mockReset()
    mockProxyWithAuth.mockReset()
  })

  afterAll(() => {
    setNodeEnv(originalNodeEnv ?? 'test')
  })

  it('returns 400 when message is blank after trim', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: '   ' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('消息内容不能为空', 'CHAT_BAD_REQUEST', 400)
  })

  it('returns 400 when message is missing', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({}),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('消息内容无效', 'CHAT_BAD_REQUEST', 400)
  })

  it('returns 400 when message is not a string', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 123 }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('消息内容无效', 'CHAT_BAD_REQUEST', 400)
  })

  it('returns 400 when request json is invalid', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => { throw new SyntaxError('Unexpected token') },
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('请求体格式无效', 'CHAT_BAD_REQUEST', 400)
  })

  it('returns 400 when request json parsing throws type error', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => { throw new TypeError('Body is unusable') },
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('请求体格式无效', 'CHAT_BAD_REQUEST', 400)
  })

  it('returns 400 when request payload is null', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => null,
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('请求体格式无效', 'CHAT_BAD_REQUEST', 400)
  })

  it('returns 400 when runtimeModelId is not a string', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', runtimeModelId: { id: 'gpt-5' } }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('模型配置无效', 'CHAT_BAD_REQUEST', 400)
    expect(mockProxyWithAuth).not.toHaveBeenCalled()
  })

  it('returns 400 when runtimeModelId is blank after trim', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', runtimeModelId: '   ' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('模型配置无效', 'CHAT_BAD_REQUEST', 400)
    expect(mockProxyWithAuth).not.toHaveBeenCalled()
  })

  it('returns 400 when difficultyLevel is out of range', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', difficultyLevel: 0 }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('任务难度无效', 'CHAT_BAD_REQUEST', 400)
    expect(mockProxyWithAuth).not.toHaveBeenCalled()
  })

  it('returns 400 when useWebSearch is not a boolean', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', useWebSearch: 'false' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('网页搜索开关无效', 'CHAT_BAD_REQUEST', 400)
    expect(mockProxyWithAuth).not.toHaveBeenCalled()
  })

  it('returns 400 when sessionId is not a string', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', sessionId: { id: 'session-1' } }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('会话标识无效', 'CHAT_BAD_REQUEST', 400)
    expect(mockProxyWithAuth).not.toHaveBeenCalled()
  })

  it('returns 400 when openclaw command has no payload', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: '/openclaw' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('OpenClaw 指令不能为空', 'CHAT_BAD_REQUEST', 400)
  })

  it('returns 400 when message exceeds 1000 characters', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'a'.repeat(1001) }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('消息内容过长，请缩短到1000字符以内', 'CHAT_BAD_REQUEST', 400)
  })

  it('delegates to proxyWithAuth with validated body on success', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({
        message: 'hello',
        taskId: 'task-1',
        sessionId: 'session-1',
        useWebSearch: true,
        useOpenClaw: false,
        taskType: 'general',
        difficultyLevel: 3,
        urgency: 'medium',
        runtimeModelId: 'model-1',
      }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockProxyWithAuth).toHaveBeenCalledWith(request, '/chat/', {
      method: 'POST',
      body: {
        message: 'hello',
        taskId: 'task-1',
        sessionId: 'session-1',
        useWebSearch: true,
        useOpenClaw: false,
        taskType: 'general',
        difficultyLevel: 3,
        urgency: 'medium',
        runtimeModelId: 'model-1',
      },
      successMessage: '对话成功',
      errorMessage: '对话请求失败',
      errorCode: 'CHAT_ERROR',
    })
  })

  it('strips message whitespace before forwarding', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: '  hello  ' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const proxyCall = mockProxyWithAuth.mock.calls[0]
    expect(proxyCall[1]).toBe('/chat/')
    expect(proxyCall[2].body.message).toBe('hello')
  })

  it('handles openclaw prefix and sets useOpenClaw flag', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: '/openclaw do something' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const proxyCall = mockProxyWithAuth.mock.calls[0]
    expect(proxyCall[2].body.message).toBe('do something')
    expect(proxyCall[2].body.useOpenClaw).toBe(true)
  })

  it('coerces useOpenClaw to boolean when prefixed', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: '/openclaw test', useOpenClaw: false }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const proxyCall = mockProxyWithAuth.mock.calls[0]
    expect(proxyCall[2].body.useOpenClaw).toBe(true)
  })

  it('accepts message when trimmed length is exactly 1000', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const message = `  ${'a'.repeat(1000)}  `
    const request = {
      json: async () => ({ message }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const proxyCall = mockProxyWithAuth.mock.calls[0]
    expect(proxyCall[2].body.message.length).toBe(1000)
  })

  it('returns CHAT_ERROR on unexpected exception', async () => {
    mockProxyWithAuth.mockImplementation(() => { throw new Error('unexpected') })

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('unexpected', 'CHAT_ERROR', 500)
  })

  it('returns CHAT_ERROR with fallback message on non-Error throw', async () => {
    mockProxyWithAuth.mockImplementation(() => { throw 'string error' })

    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('对话请求失败', 'CHAT_ERROR', 500)
  })

  it('trims sessionId before forwarding', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', sessionId: '  session-1  ' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const proxyCall = mockProxyWithAuth.mock.calls[0]
    expect(proxyCall[2].body.sessionId).toBe('session-1')
  })

  it('trims runtimeModelId before forwarding', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', runtimeModelId: '  model-1  ' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const proxyCall = mockProxyWithAuth.mock.calls[0]
    expect(proxyCall[2].body.runtimeModelId).toBe('model-1')
  })

  it('coerces useWebSearch to boolean', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', useWebSearch: true }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const proxyCall = mockProxyWithAuth.mock.calls[0]
    expect(proxyCall[2].body.useWebSearch).toBe(true)
  })

  it('returns 400 when useOpenClaw is not a boolean', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', useOpenClaw: 'yes' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('OpenClaw 开关无效', 'CHAT_BAD_REQUEST', 400)
    expect(mockProxyWithAuth).not.toHaveBeenCalled()
  })

  it('returns 400 when sessionId is blank after trim', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const request = {
      json: async () => ({ message: 'hello', sessionId: '   ' }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    expect(mockCreateErrorResponse).toHaveBeenCalledWith('会话标识无效', 'CHAT_BAD_REQUEST', 400)
  })

  it('accepts openclaw command when payload length is exactly 1000', async () => {
    const { POST } = await import('@/app/api/chat/route')

    const message = `/openclaw ${'a'.repeat(1000)}`
    const request = {
      json: async () => ({ message }),
      cookies: { get: () => undefined },
      headers: { get: () => null },
    } as any

    await POST(request)

    const proxyCall = mockProxyWithAuth.mock.calls[0]
    expect(proxyCall[2].body.message.length).toBe(1000)
    expect(proxyCall[2].body.useOpenClaw).toBe(true)
  })
})
