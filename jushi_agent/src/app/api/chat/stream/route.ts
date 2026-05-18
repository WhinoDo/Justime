import { NextRequest } from 'next/server'

/**
 * SSE Streaming Chat API Route Handler
 * Proxies SSE streaming requests to the backend Python service
 *
 * This route handler:
 * 1. Forwards the request to the backend SSE endpoint
 * 2. Streams the SSE response back to the client
 * 3. Handles authentication via cookies or Authorization header
 * 4. Supports Last-Event-ID for reconnection
 */

const MAX_AUTH_TOKEN_LENGTH = 4096

/**
 * Normalize and validate auth token
 */
function normalizeAuthToken(
  tokenValue?: string,
  options?: { allowLegacyPlusBearerSeparator?: boolean }
): string | undefined {
  const hasUnsafeTokenChars = (value: string): boolean => {
    const unsafeCharRegex = new RegExp('[\\s\\x00-\\x1F\\x7F-\\x9F\\u2028\\u2029]', 'u')
    return unsafeCharRegex.test(value)
  }

  const MAX_TOKEN_DECODE_DEPTH = 8
  const hasUnsafeEncodedTokenChars = (value: string): boolean => {
    let currentValue = value

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

    if (hasUnsafeTokenChars(trimmedCandidate)) {
      return undefined
    }

    if (hasUnsafeEncodedTokenChars(trimmedCandidate)) {
      return undefined
    }

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

  if (/^Bearer/i.test(unquotedToken)) {
    return undefined
  }

  return sanitizeToken(unquotedToken)
}

/**
 * Get backend URL from environment
 */
function getBackendUrl(): string {
  const baseUrl = (
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'http://127.0.0.1:8080'
  ).replace(/\/+$/, '')

  return `${baseUrl}/api/v1/chat/stream`
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    let body: unknown
    try {
      body = await request.json()
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof TypeError) {
        return new Response(JSON.stringify({ error: '请求体格式无效' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      throw error
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(JSON.stringify({ error: '请求体格式无效' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const parsedBody = body as Record<string, unknown>
    const { message } = parsedBody

    // Validate message
    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: '消息内容无效' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get auth token
    const rawCookieToken = request.cookies.get('access_token')?.value
    let cookieToken = rawCookieToken
    if (rawCookieToken) {
      try {
        cookieToken = decodeURIComponent(rawCookieToken)
      } catch {
        cookieToken = rawCookieToken
      }
    }

    const authorizationHeader = request.headers.get('authorization')
    const cookieAuthToken = normalizeAuthToken(cookieToken, { allowLegacyPlusBearerSeparator: true })
    const bearerTokenFromHeader = normalizeAuthToken(authorizationHeader || undefined)
    const authToken = cookieAuthToken || bearerTokenFromHeader

    // Build headers for backend request
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }

    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`
    }

    // Forward Last-Event-ID for reconnection support
    const lastEventId = request.headers.get('Last-Event-ID')
    if (lastEventId) {
      headers['Last-Event-ID'] = lastEventId
    }

    const backendUrl = getBackendUrl()

    console.log('SSE Stream API: Forwarding request to backend:', {
      backendUrl,
      hasAuthToken: !!authToken,
      hasLastEventId: !!lastEventId,
      messageLength: message.length,
    })

    // Make request to backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: response.statusText }))
      console.error('SSE Stream API: Backend error:', response.status, errorData)
      return new Response(JSON.stringify({
        error: errorData.detail || errorData.error || `HTTP ${response.status}`,
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if response is SSE stream
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/event-stream')) {
      // Not a stream, return as JSON
      const data = await response.json()
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Stream the SSE response back to client
    // Create a TransformStream to handle the streaming
    const { readable, writable } = new TransformStream()

    // Pipe the backend response to the client
    const writer = writable.getWriter()
    const reader = response.body?.getReader()

    if (!reader) {
      return new Response(JSON.stringify({ error: 'Backend response not readable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Start streaming in background
    ;(async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            await writer.close()
            break
          }
          await writer.write(value)
        }
      } catch (error) {
        console.error('SSE Stream API: Streaming error:', error)
        try {
          await writer.abort(error as Error)
        } catch {
          // Writer may already be closed
        }
      }
    })()

    // Return SSE stream to client
    return new Response(readable, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Last-Event-ID',
      },
    })

  } catch (error) {
    console.error('SSE Stream API Error:', error)
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Internal server error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
