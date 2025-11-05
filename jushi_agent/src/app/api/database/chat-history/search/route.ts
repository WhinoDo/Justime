/**
 * 聊天记录搜索API
 */

import { NextRequest, NextResponse } from 'next/server'
import { ChatHistoryService } from '@/lib/database/services/ChatHistoryService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 搜索用户的聊天记录
 * GET /api/database/chat-history/search?userId=xxx&query=xxx&limit=20
 */
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const query = searchParams.get('query')
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: '搜索关键词不能为空'
      }, { status: 400 })
    }

    const sessions = await ChatHistoryService.searchSessions(userId, query.trim(), limit)

    return NextResponse.json({
      success: true,
      data: { 
        sessions,
        query: query.trim(),
        total: sessions.length
      }
    })

  } catch (error) {
    console.error('❌ 搜索聊天记录失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '搜索失败'
    }, { status: 500 })
  }
})
