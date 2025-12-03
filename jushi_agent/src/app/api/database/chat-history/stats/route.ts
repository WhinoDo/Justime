/**
 * 聊天记录统计API
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取用户的聊天统计信息
 * GET /api/database/chat-history/stats?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return createErrorResponse('缺少用户ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的统计API
    const backendUrl = API_CONFIG.getFullUrl(`/database/chat-history/stats?userId=${userId}`)
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '获取统计信息失败', 'FETCH_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '获取成功')

  } catch (error) {
    console.error('❌ 获取聊天统计失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '获取统计信息失败', 'INTERNAL_ERROR', 500)
  }
}
