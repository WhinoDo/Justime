/**
 * 对话API路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/lib/database/services/ConversationService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 获取对话列表或搜索对话
 * GET /api/database/conversations?userId=xxx&page=1&limit=20&search=xxx
 */
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const conversationId = searchParams.get('conversationId')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status') as 'active' | 'archived' | 'deleted' || 'active'
    const type = searchParams.get('type')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    // 获取单个对话详情
    if (conversationId) {
      const conversation = await ConversationService.getConversationById(conversationId, userId)
      
      if (!conversation) {
        return NextResponse.json({
          success: false,
          error: '对话不存在'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: { conversation }
      })
    }

    // 搜索对话
    if (search) {
      const result = await ConversationService.searchConversations(userId, search, { page, limit })
      
      return NextResponse.json({
        success: true,
        data: result
      })
    }

    // 获取对话列表
    const result = await ConversationService.getUserConversations(userId, {
      page,
      limit,
      status,
      type
    })

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('❌ 获取对话失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取对话失败'
    }, { status: 500 })
  }
})

/**
 * 创建新对话
 * POST /api/database/conversations
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { userId, title, type = 'general', firstMessage } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({
        success: false,
        error: '缺少对话标题'
      }, { status: 400 })
    }

    // 创建对话
    const conversation = await ConversationService.createConversation(userId, title, type)

    // 如果有首条消息，添加到对话中
    if (firstMessage) {
      await ConversationService.addMessage(conversation._id, firstMessage)
    }

    return NextResponse.json({
      success: true,
      data: { conversation }
    })

  } catch (error) {
    console.error('❌ 创建对话失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建对话失败'
    }, { status: 500 })
  }
})

/**
 * 更新对话信息
 * PUT /api/database/conversations
 */
export const PUT = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { conversationId, userId, title, status, taskId, taskStatus } = body

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: '缺少对话ID'
      }, { status: 400 })
    }

    let result = null

    // 更新对话标题
    if (title) {
      result = await ConversationService.updateConversationTitle(conversationId, title, userId)
    }

    // 归档对话
    if (status === 'archived') {
      const archived = await ConversationService.archiveConversation(conversationId, userId)
      result = { archived }
    }

    // 更新任务状态
    if (taskId && taskStatus) {
      const updated = await ConversationService.updateTaskStatus(conversationId, taskId, taskStatus, userId)
      result = { taskUpdated: updated }
    }

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('❌ 更新对话失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '更新对话失败'
    }, { status: 500 })
  }
})

/**
 * 删除对话
 * DELETE /api/database/conversations?conversationId=xxx&userId=xxx
 */
export const DELETE = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const userId = searchParams.get('userId')

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: '缺少对话ID'
      }, { status: 400 })
    }

    const deleted = await ConversationService.deleteConversation(conversationId, userId)

    if (!deleted) {
      return NextResponse.json({
        success: false,
        error: '对话不存在或删除失败'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })

  } catch (error) {
    console.error('❌ 删除对话失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '删除对话失败'
    }, { status: 500 })
  }
})
