/**
 * 用户注册API
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

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

    // 设置HTTP-only cookie
    const nextResponse = createSuccessResponse(data.data ?? data, data.message || '注册成功')

    if (data.success && data.data?.token) {
      nextResponse.cookies.set('access_token', data.data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7天
      })
    }

    if (data.success && data.data?.refreshToken) {
      nextResponse.cookies.set('refresh-token', data.data.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30天
      })
    }

    return nextResponse

  } catch (error) {
    console.error('❌ 注册API错误:', error)
    return createErrorResponse(error instanceof Error ? error.message : '服务器内部错误', 'INTERNAL_ERROR', 500)
  }
}
