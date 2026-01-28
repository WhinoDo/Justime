/**
 * 刷新令牌API
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 刷新访问令牌
 * POST /api/auth/refresh
 */
export async function POST(request: NextRequest) {
  try {
    // 从cookie中获取refresh token（后端会自动处理）
    // 调用后端Python服务的刷新令牌API
    const backendUrl = API_CONFIG.getFullUrl('/auth/refresh')

    // 获取cookie并传递给后端
    const refreshToken = request.cookies.get('refresh-token')?.value

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': refreshToken ? `refresh-token=${refreshToken}` : ''
      },
      body: JSON.stringify({
        refreshToken: refreshToken || undefined
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '刷新令牌失败', 'REFRESH_ERROR', response.status)
    }

    // 设置新的认证cookie
    const nextResponse = createSuccessResponse(data.data ?? data, data.message || '刷新成功')

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
    console.error('❌ 刷新令牌API错误:', error)
    return createErrorResponse(error instanceof Error ? error.message : '服务器内部错误', 'INTERNAL_ERROR', 500)
  }
}
