/**
 * 对话API路由
 * 现在将请求转发到后端Python服务
 */

import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取对话列表或搜索对话
 * GET /api/database/conversations?userId=xxx&page=1&limit=20&search=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // 构建查询参数
    const params = new URLSearchParams()
    const userId = searchParams.get('userId')
    const conversationId = searchParams.get('conversationId')
    const search = searchParams.get('search')
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '20'
    const status = searchParams.get('status') || 'active'
    const type = searchParams.get('type')
    
    if (userId) params.append('userId', userId)
    if (conversationId) params.append('conversationId', conversationId)
    if (search) params.append('search', search)
    params.append('page', page)
    params.append('limit', limit)
    params.append('status', status)
    if (type) params.append('type', type)

    if (!userId && !conversationId) {
      return createErrorResponse('缺少用户ID或对话ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的对话API
    const backendUrl = API_CONFIG.getFullUrl(`/database/conversations?${params.toString()}`)
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '获取对话失败', 'FETCH_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '获取成功')

  } catch (error) {
    console.error('❌ 获取对话失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取对话失败'
    }, { status: 500 })
  }
}

/**
 * 创建新对话
 * POST /api/database/conversations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.userId) {
      return createErrorResponse('缺少用户ID', 'VALIDATION_ERROR', 400)
    }

    if (!body.title) {
      return createErrorResponse('缺少对话标题', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的对话API
    const backendUrl = API_CONFIG.getFullUrl('/database/conversations')
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '创建对话失败', 'CREATE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '创建成功')

  } catch (error) {
    console.error('❌ 创建对话失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建对话失败'
    }, { status: 500 })
  }
}

/**
 * 更新对话信息
 * PUT /api/database/conversations
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.conversationId) {
      return createErrorResponse('缺少对话ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的对话API
    const backendUrl = API_CONFIG.getFullUrl('/database/conversations')
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '更新对话失败', 'UPDATE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '更新成功')

  } catch (error) {
    console.error('❌ 更新对话失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '更新对话失败'
    }, { status: 500 })
  }
}

/**
 * 删除对话
 * DELETE /api/database/conversations?conversationId=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')

    if (!conversationId) {
      return createErrorResponse('缺少对话ID', 'VALIDATION_ERROR', 400)
    }

    // 调用后端Python服务的对话API
    const backendUrl = API_CONFIG.getFullUrl(`/database/conversations?conversationId=${conversationId}`)
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const data = await response.json()

    if (!response.ok) {
      return createErrorResponse(data.detail || data.error || '删除对话失败', 'DELETE_ERROR', response.status)
    }

    return createSuccessResponse(data.data ?? data, '删除成功')

  } catch (error) {
    console.error('❌ 删除对话失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '删除对话失败'
    }, { status: 500 })
  }
}
