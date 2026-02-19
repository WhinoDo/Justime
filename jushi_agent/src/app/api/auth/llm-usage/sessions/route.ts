import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取当前用户模型会话级 token 使用统计
 * GET /api/auth/llm-usage/sessions?days=14&scope=primary
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('access_token')?.value
    if (!authToken) {
      return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
    }

    const days = request.nextUrl.searchParams.get('days') || '14'
    const scope = request.nextUrl.searchParams.get('scope') || 'primary'
    const backendUrl = API_CONFIG.getFullUrl(
      `/auth/llm-usage/sessions?days=${encodeURIComponent(days)}&scope=${encodeURIComponent(scope)}`
    )
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
      },
      credentials: 'include',
      cache: 'no-store'
    })

    const result = await response.json()
    if (!response.ok) {
      return createErrorResponse(
        result.detail || result.message || '获取模型会话级 token 统计失败',
        'FETCH_USAGE_ERROR',
        response.status
      )
    }

    return createSuccessResponse(result.data ?? result, '获取模型会话级 token 统计成功')
  } catch (error) {
    console.error('获取模型会话级 token 统计失败:', error)
    return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
  }
}
