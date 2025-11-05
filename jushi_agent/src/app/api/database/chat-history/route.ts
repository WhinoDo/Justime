/**
 * 聊天记录API路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { ChatHistoryService } from '@/lib/database/services/ChatHistoryService'
import { MessageType } from '@/lib/database/models/ChatHistory'
import { withDatabase } from '@/lib/database/connection'

/**
 * 获取用户的聊天会话列表
 * GET /api/database/chat-history?userId=xxx&status=active&limit=50&offset=0
 */
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const status = searchParams.get('status') as 'active' | 'archived' | 'deleted' || 'active'
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const sessionId = searchParams.get('sessionId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    // 如果指定了sessionId，返回单个会话详情
    if (sessionId) {
      const session = await ChatHistoryService.getSession(sessionId)
      
      if (!session) {
        return NextResponse.json({
          success: false,
          error: '会话不存在'
        }, { status: 404 })
      }

      // 检查权限：确保会话属于当前用户
      if (session.userId !== userId) {
        return NextResponse.json({
          success: false,
          error: '无权访问此会话'
        }, { status: 403 })
      }

      return NextResponse.json({
        success: true,
        data: { session }
      })
    }

    // 获取用户的会话列表
    const sessions = await ChatHistoryService.getUserSessions(userId, status, limit, offset)

    return NextResponse.json({
      success: true,
      data: { 
        sessions,
        pagination: {
          limit,
          offset,
          total: sessions.length
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取聊天记录失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取聊天记录失败'
    }, { status: 500 })
  }
})

/**
 * 创建新的聊天会话或添加消息
 * POST /api/database/chat-history
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { action, userId, sessionId, ...data } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    switch (action) {
      case 'create_session': {
        const { title, settings } = data
        const session = await ChatHistoryService.createSession(userId, { title, settings })
        
        return NextResponse.json({
          success: true,
          data: { session }
        })
      }

      case 'add_message': {
        const { type, content, options } = data
        
        if (!sessionId) {
          return NextResponse.json({
            success: false,
            error: '缺少会话ID'
          }, { status: 400 })
        }

        if (!type || !content) {
          return NextResponse.json({
            success: false,
            error: '缺少消息类型或内容'
          }, { status: 400 })
        }

        const session = await ChatHistoryService.addMessage(
          sessionId,
          type as MessageType,
          content,
          options
        )

        return NextResponse.json({
          success: true,
          data: { session }
        })
      }

      case 'add_messages': {
        const { messages } = data
        
        if (!sessionId) {
          return NextResponse.json({
            success: false,
            error: '缺少会话ID'
          }, { status: 400 })
        }

        if (!Array.isArray(messages) || messages.length === 0) {
          return NextResponse.json({
            success: false,
            error: '消息列表不能为空'
          }, { status: 400 })
        }

        const session = await ChatHistoryService.addMessages(sessionId, messages)

        return NextResponse.json({
          success: true,
          data: { session }
        })
      }

      case 'get_or_create_active': {
        const session = await ChatHistoryService.getOrCreateActiveSession(userId)
        
        return NextResponse.json({
          success: true,
          data: { session }
        })
      }

      default:
        return NextResponse.json({
          success: false,
          error: '无效的操作类型'
        }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ 处理聊天记录请求失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '处理请求失败'
    }, { status: 500 })
  }
})

/**
 * 更新聊天会话
 * PUT /api/database/chat-history
 */
export const PUT = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { action, sessionId, ...data } = body

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: '缺少会话ID'
      }, { status: 400 })
    }

    let result = false

    switch (action) {
      case 'update_title': {
        const { title } = data
        if (!title) {
          return NextResponse.json({
            success: false,
            error: '缺少会话标题'
          }, { status: 400 })
        }
        result = await ChatHistoryService.updateSessionTitle(sessionId, title)
        break
      }

      case 'update_settings': {
        const { settings } = data
        if (!settings) {
          return NextResponse.json({
            success: false,
            error: '缺少会话设置'
          }, { status: 400 })
        }
        result = await ChatHistoryService.updateSessionSettings(sessionId, settings)
        break
      }

      case 'archive': {
        result = await ChatHistoryService.archiveSession(sessionId)
        break
      }

      case 'restore': {
        result = await ChatHistoryService.restoreSession(sessionId)
        break
      }

      default:
        return NextResponse.json({
          success: false,
          error: '无效的操作类型'
        }, { status: 400 })
    }

    if (result) {
      return NextResponse.json({
        success: true,
        data: { updated: true }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '更新失败'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ 更新聊天记录失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '更新失败'
    }, { status: 500 })
  }
})

/**
 * 删除聊天会话
 * DELETE /api/database/chat-history?sessionId=xxx&permanent=false
 */
export const DELETE = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const permanent = searchParams.get('permanent') === 'true'

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: '缺少会话ID'
      }, { status: 400 })
    }

    let result = false

    if (permanent) {
      result = await ChatHistoryService.permanentDeleteSession(sessionId)
    } else {
      result = await ChatHistoryService.deleteSession(sessionId)
    }

    if (result) {
      return NextResponse.json({
        success: true,
        data: { deleted: true, permanent }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '删除失败'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ 删除聊天记录失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '删除失败'
    }, { status: 500 })
  }
})
