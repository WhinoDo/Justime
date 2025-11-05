/**
 * 对话消息API路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { ConversationService } from '@/lib/database/services/ConversationService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 添加消息到对话
 * POST /api/database/conversations/messages
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { conversationId, messageData } = body

    if (!conversationId) {
      return NextResponse.json({
        success: false,
        error: '缺少对话ID'
      }, { status: 400 })
    }

    if (!messageData || !messageData.role || !messageData.content) {
      return NextResponse.json({
        success: false,
        error: '缺少消息数据'
      }, { status: 400 })
    }

    // 添加消息到对话
    const conversation = await ConversationService.addMessage(conversationId, messageData)

    return NextResponse.json({
      success: true,
      data: {
        conversation,
        messageId: conversation.messages[conversation.messages.length - 1].messageId
      }
    })

  } catch (error) {
    console.error('❌ 添加消息失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '添加消息失败'
    }, { status: 500 })
  }
})
