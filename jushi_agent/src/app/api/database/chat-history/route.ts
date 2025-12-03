/**
 * 聊天记录API路由
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取用户的聊天会话列表
 * GET /api/database/chat-history?userId=xxx&status=active&limit=50&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 构建查询参数
    const params = new URLSearchParams()
    const userId = searchParams.get('userId')
    const sessionId = searchParams.get('sessionId')
    const status = searchParams.get('status') || 'active'
    const limit = searchParams.get('limit') || '50'
    const offset = searchParams.get('offset') || '0'
    
    if (userId) params.append('userId', userId)
    if (sessionId) params.append('sessionId', sessionId)
    params.append('status', status)
    params.append('limit', limit)
    params.append('offset', offset)

    if (!userId && !sessionId) {
      return createErrorResponse('缺少用户ID或会话ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的聊天历史API
    const backendUrl = API_CONFIG.getFullUrl(`/database/chat-history?${params.toString()}`)
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '获取聊天记录失败', 'FETCH_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '获取成功')

  } catch (error) {
    console.error('❌ 获取聊天记录失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取聊天记录失败'
    }, { status: 500 })
  }
}

/**
 * 创建新的聊天会话或添加消息
 * POST /api/database/chat-history
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.userId) {
      return createErrorResponse('缺少用户ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的聊天历史API
    const backendUrl = API_CONFIG.getFullUrl('/database/chat-history')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '处理聊天记录请求失败', 'UPDATE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '处理成功')

  } catch (error) {
    console.error('❌ 处理聊天记录请求失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '处理请求失败'
    }, { status: 500 })
  }
}

/**
 * 更新聊天会话
 * PUT /api/database/chat-history
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.sessionId) {
      return createErrorResponse('缺少会话ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的聊天历史API
    const backendUrl = API_CONFIG.getFullUrl('/database/chat-history')
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '更新聊天记录失败', 'UPDATE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '更新成功')

  } catch (error) {
    console.error('❌ 更新聊天记录失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '更新失败'
    }, { status: 500 })
  }
}

/**
 * 删除聊天会话
 * DELETE /api/database/chat-history?sessionId=xxx&permanent=false
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const permanent = searchParams.get('permanent') === 'true'

    if (!sessionId) {
      return createErrorResponse('缺少会话ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的聊天历史API
    const backendUrl = API_CONFIG.getFullUrl(`/database/chat-history?${params.toString()}`)
    const params = new URLSearchParams({ sessionId })
    if (permanent) params.append('permanent', 'true')
    
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '删除失败', 'DELETE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '删除成功')

  } catch (error) {
    console.error('❌ 删除聊天记录失败:', error)
    return createErrorResponse(error instanceof Error ? error.message : '删除失败', 'INTERNAL_ERROR', 500)
  }
}
