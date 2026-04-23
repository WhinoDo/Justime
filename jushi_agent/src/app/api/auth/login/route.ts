/**
 * 用户登录API
 * 将请求转发到后端Python服务
 */

import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse, validateRequiredFields } from '@/lib/api/proxy'
import { setAuthCookies } from '@/lib/api/auth-cookies'

/**
 * 用户登录
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { identifier, password, rememberMe } = body

    // 验证必填字段
    const validation = validateRequiredFields({ identifier, password }, ['identifier', 'password'])
    if (!validation.valid) {
      return createErrorResponse(`缺少必填字段: ${validation.missing.join(', ')}`, 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的登录API
    const backendUrl = API_CONFIG.getFullUrl('/auth/login')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier,
        password,
        rememberMe: rememberMe || false
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '登录失败', 'LOGIN_ERROR', response.status)
    }

    const nextResponse = createSuccessResponse(data.data, data.message || '登录成功')

    if (data.success) {
      setAuthCookies(nextResponse, {
        accessToken: data.data?.token,
        refreshToken: data.data?.refreshToken,
        rememberMe: rememberMe || false,
      })
    }

    return nextResponse

  } catch (error) {
    console.error('❌ 登录API错误:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '服务器内部错误',
      'INTERNAL_ERROR',
      500
    )
  }
}
