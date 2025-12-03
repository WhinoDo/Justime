/**
 * 聊天记录搜索API
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 搜索用户的聊天记录
 * GET /api/database/chat-history/search?userId=xxx&query=xxx&limit=20
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const query = searchParams.get('query')
    const limit = searchParams.get('limit') || '20'

    if (!userId) {
      return createErrorResponse('缺少用户ID', 'VALIDATION_ERROR', 400)
    }

    if (!query || query.trim().length === 0) {
      return createErrorResponse('搜索关键词不能为空', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的搜索API
    const backendUrl = API_CONFIG.getFullUrl(`/database/chat-history/search?${params.toString()}`)
    const params = new URLSearchParams({
      userId,
      query: query.trim(),
      limit
    })
    
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '搜索失败', 'SEARCH_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '搜索成功')

  } catch (error) {
    console.error('❌ 搜索聊天记录失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '搜索失败', 'INTERNAL_ERROR', 500)
  }
}
