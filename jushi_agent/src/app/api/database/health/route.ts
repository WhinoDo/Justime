/**
 * 数据库健康检查API
 */

import { NextRequest, NextResponse } from 'next/server'
import { dbConnection } from '@/lib/database/connection'
import { User } from '@/lib/database/models/User'
import { Conversation } from '@/lib/database/models/Conversation'

/**
 * 数据库健康检查
 * GET /api/database/health
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 检查数据库连接状态
    const connectionState = dbConnection.getState()
    
    // 尝试连接数据库
    await dbConnection.connect()
    
    // 执行健康检查
    const isHealthy = await dbConnection.healthCheck()
    
    // 获取数据库统计信息
    const [userCount, conversationCount] = await Promise.all([
      User.countDocuments({ status: 'active' }),
      Conversation.countDocuments({ status: 'active' })
    ])
    
    // 计算响应时间
    const responseTime = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        connection: {
          isConnected: connectionState.isConnected,
          isConnecting: connectionState.isConnecting,
          error: connectionState.error
        },
        statistics: {
          activeUsers: userCount,
          activeConversations: conversationCount,
          responseTime: `${responseTime}ms`
        },
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    })

  } catch (error) {
    const responseTime = Date.now() - startTime
    
    console.error('❌ 数据库健康检查失败:', error)
    
    return NextResponse.json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : '数据库健康检查失败',
        code: 'DATABASE_HEALTH_CHECK_FAILED',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }
    }, { status: 500 })
  }
}
