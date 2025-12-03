/**
 * 获取当前用户信息API
 * 将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export async function GET(request: NextRequest) {
  try {
    // 从cookie中获取token
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return createErrorResponse('未登录', 'AUTHENTICATION_ERROR', 401)
    }

    // 调用后端Python服务的获取用户信息API
    const backendUrl = API_CONFIG.getFullUrl('/auth/me')
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(
        data.detail || data.error || '获取用户信息失败',
        'FETCH_USER_ERROR',
        response.status
      )
    }

    return createSuccessResponse(data.data, data.message || '获取用户信息成功')

  } catch (error) {
    console.error('❌ 获取用户信息API错误:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '服务器内部错误',
      'INTERNAL_ERROR',
      500
    )
  }
}
