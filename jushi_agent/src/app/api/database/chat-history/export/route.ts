/**
 * 聊天记录导出API
 */

import { NextRequest, NextResponse } from 'next/server'
import { ChatHistoryService } from '@/lib/database/services/ChatHistoryService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 导出用户的聊天记录
 * GET /api/database/chat-history/export?userId=xxx&format=json
 */
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const format = searchParams.get('format') || 'json'

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    const chatHistory = await ChatHistoryService.exportUserChatHistory(userId)

    if (format === 'json') {
      return NextResponse.json({
        success: true,
        data: chatHistory
      })
    }

    // 如果需要其他格式（如CSV），可以在这里添加处理逻辑
    return NextResponse.json({
      success: false,
      error: '不支持的导出格式'
    }, { status: 400 })

  } catch (error) {
    console.error('❌ 导出聊天记录失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '导出失败'
    }, { status: 500 })
  }
})
