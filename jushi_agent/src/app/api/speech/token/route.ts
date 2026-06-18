/**
 * 语音 Token API
 * 代理到后端阿里云语音服务 Token 接口
 */

import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'
import { resolveAuthorizationHeader } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
  try {
    const authorization = resolveAuthorizationHeader(request)
    if (!authorization) {
      return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
    }

    const forceRefresh = request.nextUrl.searchParams.get('force_refresh') === 'true'
    const backendUrl = API_CONFIG.getFullUrl('/speech/token') +
      (forceRefresh ? '?force_refresh=true' : '')

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      return createErrorResponse(
        data.detail || data.message || '获取语音 Token 失败',
        'SPEECH_TOKEN_ERROR',
        response.status,
      )
    }

    return createSuccessResponse(data.data, data.message || '获取语音 Token 成功')
  } catch (error) {
    console.error('❌ 语音 Token API 错误:', error)
    return createErrorResponse(
      error instanceof Error ? error.message : '服务器内部错误',
      'INTERNAL_ERROR',
      500,
    )
  }
}
