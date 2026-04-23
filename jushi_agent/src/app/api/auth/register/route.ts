/**
 * 用户注册API
 * 现在将请求转发到后端Python服务
 */

import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'
import { setAuthCookies } from '@/lib/api/auth-cookies'

/**
 * 用户注册
 * POST /api/auth/register
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 调用后端Python服务的注册API
    const backendUrl = API_CONFIG.getFullUrl('/auth/register')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '注册失败', 'REGISTER_ERROR', response.status)
    }

    const nextResponse = createSuccessResponse(data.data ?? data, data.message || '注册成功')

    if (data.success) {
      setAuthCookies(nextResponse, {
        accessToken: data.data?.token,
        refreshToken: data.data?.refreshToken,
        rememberMe: false,
      })
    }

    return nextResponse

  } catch (error) {
    console.error('❌ 注册API错误:', error)
    return createErrorResponse(error instanceof Error ? error.message : '服务器内部错误', 'INTERNAL_ERROR', 500)
  }
}
