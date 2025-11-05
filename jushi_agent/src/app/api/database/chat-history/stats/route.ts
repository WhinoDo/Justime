/**
 * 聊天记录统计API
 */

import { NextRequest, NextResponse } from 'next/server'
import { ChatHistoryService } from '@/lib/database/services/ChatHistoryService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 获取用户的聊天统计信息
 * GET /api/database/chat-history/stats?userId=xxx
 */
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    const stats = await ChatHistoryService.getUserChatStats(userId)

    return NextResponse.json({
      success: true,
      data: { stats }
    })

  } catch (error) {
    console.error('❌ 获取聊天统计失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取统计信息失败'
    }, { status: 500 })
  }
})
