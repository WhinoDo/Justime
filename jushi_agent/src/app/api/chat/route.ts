import { NextRequest, NextResponse } from 'next/server'
import { APIResponse, ChatRequest, ChatResponse } from '@/types'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 聊天API路由
 * 现在将请求转发到后端Python服务
 */
export async function POST(request: NextRequest) {
  try {
    const MAX_AUTH_TOKEN_LENGTH = 4096
    const createBadRequestError = (message: string): Error => {
      const badRequestError = new Error(message)
      badRequestError.name = 'BadRequestError'
      return badRequestError
    }

    const normalizeAuthToken = (
      tokenValue?: string,
      options?: { allowLegacyPlusBearerSeparator?: boolean }
    ): string | undefined => {
      const hasUnsafeTokenChars = (value: string): boolean =>
        /[\s\x00-\x1F\x7F-\x9F\u2028\u2029]/u.test(value)

      const MAX_TOKEN_DECODE_DEPTH = 8
      const hasUnsafeEncodedTokenChars = (value: string): boolean => {
        let currentValue = value

        // Decode iteratively to block multi-layer percent-encoding bypasses.
        for (let depth = 0; depth < MAX_TOKEN_DECODE_DEPTH; depth += 1) {
          if (hasUnsafeTokenChars(currentValue)) {
            return true
          }

          if (!/%[0-9a-f]{2}/i.test(currentValue)) {
            return false
          }

          try {
            const decodedValue = decodeURIComponent(currentValue)
            if (decodedValue === currentValue) {
              return false
            }
            currentValue = decodedValue
          } catch {
            return true
          }
        }

        // Still encoded after max depth: treat as unsafe to avoid deep-encoding bypasses.
        if (/%[0-9a-f]{2}/i.test(currentValue)) {
          return true
        }

        return hasUnsafeTokenChars(currentValue)
      }

      const sanitizeToken = (candidate?: string): string | undefined => {
        if (!candidate) {
          return undefined
        }

        const trimmedCandidate = candidate.trim()
        if (!trimmedCandidate) {
          return undefined
        }

        // Bearer token payload should not include separators/control chars.
        if (hasUnsafeTokenChars(trimmedCandidate)) {
          return undefined
        }

        // Reject encoded separators/control chars at any encoding depth.
        if (hasUnsafeEncodedTokenChars(trimmedCandidate)) {
          return undefined
        }

        // Guard against abnormal oversized token values from malformed clients.
        if (trimmedCandidate.length > MAX_AUTH_TOKEN_LENGTH) {
          return undefined
        }

        return trimmedCandidate
      }

      if (!tokenValue) {
        return undefined
      }

      const trimmedToken = tokenValue.trim()
      if (!trimmedToken) {
        return undefined
      }

      const unquotedToken = trimmedToken.replace(/^(['"])(.*)\1$/, '$2').trim()
      if (!unquotedToken) {
        return undefined
      }

      // Ignore common placeholder values from broken cookie writes
      if (/^(undefined|null)$/i.test(unquotedToken)) {
        return undefined
      }

      const bearerMatch = unquotedToken.match(/^Bearer(?:\s+(.+))?$/i)
      if (bearerMatch) {
        const bearerPayload = bearerMatch[1]?.trim()
        if (!bearerPayload) {
          return undefined
        }
        const normalizedBearerPayload = bearerPayload.replace(/^(['"])(.*)\1$/, '$2').trim()
        if (!normalizedBearerPayload || /^(undefined|null)$/i.test(normalizedBearerPayload)) {
          return undefined
        }
        return sanitizeToken(normalizedBearerPayload)
      }

      const legacyPlusBearerMatch = options?.allowLegacyPlusBearerSeparator
        ? unquotedToken.match(/^Bearer\+(.+)$/i)
        : null
      if (legacyPlusBearerMatch) {
        const bearerPayload = legacyPlusBearerMatch[1]?.trim()
        if (!bearerPayload) {
          return undefined
        }
        const normalizedBearerPayload = bearerPayload.replace(/^(['"])(.*)\1$/, '$2').trim()
        if (!normalizedBearerPayload || /^(undefined|null)$/i.test(normalizedBearerPayload)) {
          return undefined
        }
        return sanitizeToken(normalizedBearerPayload)
      }

      // Fail closed for malformed Bearer schemes (e.g. Bearer+token in headers).
      if (/^Bearer/i.test(unquotedToken)) {
        return undefined
      }

      return sanitizeToken(unquotedToken)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError) {
        throw createBadRequestError('请求体格式无效')
      }
      throw error
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw createBadRequestError('请求体格式无效')
    }

    const parsedBody = body as ChatRequest & { runtimeModelId?: unknown; sessionId?: unknown }
    const { message, taskId, sessionId, useWebSearch, useOpenClaw, taskType, difficultyLevel, urgency, runtimeModelId } = parsedBody

    // 输入验证
    if (!message || typeof message !== 'string') {
      throw createBadRequestError('消息内容无效')
    }
    let normalizedRuntimeModelId: string | undefined
    if (runtimeModelId !== undefined) {
      if (typeof runtimeModelId !== 'string') {
        throw createBadRequestError('模型配置无效')
      }
      normalizedRuntimeModelId = runtimeModelId.trim()
      if (!normalizedRuntimeModelId) {
        throw createBadRequestError('模型配置无效')
      }
    }
    if (
      difficultyLevel !== undefined &&
      (!Number.isInteger(difficultyLevel) || difficultyLevel < 1 || difficultyLevel > 5)
    ) {
      throw createBadRequestError('任务难度无效')
    }
    let normalizedSessionId: string | undefined
    if (sessionId !== undefined) {
      if (typeof sessionId !== 'string') {
        throw createBadRequestError('会话标识无效')
      }
      normalizedSessionId = sessionId.trim()
      if (!normalizedSessionId) {
        throw createBadRequestError('会话标识无效')
      }
    }

    // 清理输入
    let cleanMessage = message.trim()
    if (!cleanMessage) {
      throw createBadRequestError('消息内容不能为空')
    }

    // 兼容无 UI 开关时的显式特殊任务前缀
    const prefixedOpenClaw = /^\/openclaw(?:\s+|$)/.test(cleanMessage)
    if (prefixedOpenClaw) {
      cleanMessage = cleanMessage.replace(/^\/openclaw(?:\s+|$)/, '').trim()
    }
    if (!cleanMessage) {
      throw createBadRequestError('OpenClaw 指令不能为空')
    }

    if (cleanMessage.length > 1000) {
      throw createBadRequestError('消息内容过长，请缩短到1000字符以内')
    }

    // 获取认证token (从cookie或Authorization header)
    // 后端使用的是 'access_token'
    const rawCookieToken = request.cookies.get('access_token')?.value
    let cookieToken = rawCookieToken
    if (rawCookieToken) {
      try {
        // Cookie values are URI-encoded; keep literal '+' payload bytes intact.
        cookieToken = decodeURIComponent(rawCookieToken)
      } catch {
        cookieToken = rawCookieToken
      }
    }
    const authorizationHeader = request.headers.get('authorization')
    const cookieAuthToken = normalizeAuthToken(cookieToken, { allowLegacyPlusBearerSeparator: true })
    const bearerTokenFromHeader = normalizeAuthToken(authorizationHeader || undefined)
    const authToken = cookieAuthToken || bearerTokenFromHeader

    // 构建请求头
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    // 如果有token，添加到请求头 (后端期待 Bearer <token>)
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    const isProduction = process.env.NODE_ENV === 'production'

    console.log('Chat API: 转发请求到后端服务:', {
      message: isProduction ? '[REDACTED]' : cleanMessage.substring(0, 100),
      taskId,
      taskType,
      difficultyLevel,
      urgency,
      useOpenClaw: Boolean(useOpenClaw || prefixedOpenClaw),
      useWebSearch,
      messageLength: cleanMessage.length,
      ...(isProduction ? {} : { backendUrl: API_CONFIG.BASE_URL }),
      hasAuthToken: !!authToken
    })

    // 调用后端Python服务的聊天API
    // 后端路由是 /api/v1/chat/
    const backendUrl = API_CONFIG.getFullUrl('/chat/')
    if (isProduction) {
      let backendPath = '/api/v1/chat/'
      try {
        const parsedBackendUrl = new URL(backendUrl)
        backendPath = `${parsedBackendUrl.pathname}${parsedBackendUrl.search}`
      } catch {
        // fallback to default path when URL parsing fails
      }
      console.log('Chat API: 实际调用的后端路径:', backendPath)
    } else {
      console.log('Chat API: 实际调用的后端地址:', backendUrl)
    }

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: cleanMessage,
        taskId: taskId,
        sessionId: normalizedSessionId,
        useWebSearch: !!useWebSearch,
        useOpenClaw: Boolean(useOpenClaw || prefixedOpenClaw),
        taskType: taskType,
        difficultyLevel: difficultyLevel,
        urgency: urgency,
        runtimeModelId: normalizedRuntimeModelId
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      if (isProduction) {
        console.error('Chat API: 后端返回错误:', {
          status: response.status,
          statusText: response.statusText,
          timestamp: new Date().toISOString()
        })
      } else {
        console.error('Chat API: 后端返回错误:', response.status, errorData)
      }

      const backendErrorMessage = errorData.detail || errorData.error || `HTTP ${response.status}: ${response.statusText}`
      throw new Error(isProduction ? `Backend request failed: ${response.status}` : backendErrorMessage)
    }

    const backendResponse = await response.json()

    // 转换后端响应格式为前端期望的格式
    const frontendResponse: APIResponse<ChatResponse> = {
      success: backendResponse.success,
      data: backendResponse.data,
      error: backendResponse.error,
      timestamp: backendResponse.timestamp || new Date().toISOString()
    }

    console.log('Chat API: 后端响应成功')
    return NextResponse.json(frontendResponse)

  } catch (error) {
    const isProduction = process.env.NODE_ENV === 'production'
    const isBadRequestError = error instanceof Error && error.name === 'BadRequestError'
    const statusCode = isBadRequestError ? 400 : 500

    console.error('Chat API Error详情:', isProduction
      ? {
        message: isBadRequestError ? 'chat request payload invalid' : 'chat request failed',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
      : {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
      }
    )

    const errorResponse: APIResponse<ChatResponse> = {
      success: false,
      error: {
        code: isBadRequestError ? 'CHAT_BAD_REQUEST' : 'CHAT_ERROR',
        message: isBadRequestError
          ? '请求格式无效，请刷新后重试。'
          : '抱歉，我现在遇到了一些技术问题。请稍后再试，或者描述一下您遇到的具体情况。',
        details: process.env.NODE_ENV === 'development'
          ? String(error)
          : (isBadRequestError ? 'Invalid request payload' : 'Internal server error')
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: statusCode })
  }
}
