/**
 * 对话消息API路由
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 添加消息到对话
 * POST /api/database/conversations/messages
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { conversationId, messageData } = body

    if (!conversationId) {
      return createErrorResponse('缺少对话ID', 'VALIDATION_ERROR', 400)
    }

    if (!messageData || !messageData.role || !messageData.content) {
      return createErrorResponse('缺少消息数据', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的对话消息API
    const backendUrl = API_CONFIG.getFullUrl('/database/conversations/messages')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        role: messageData.role,
        content: messageData.content,
        metadata: messageData.metadata || {}
      })
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '添加消息失败', 'CREATE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '添加成功')

  } catch (error) {
    console.error('❌ 添加消息失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '添加消息失败', 'INTERNAL_ERROR', 500)
  }
}
