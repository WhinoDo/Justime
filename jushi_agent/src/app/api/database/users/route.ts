/**
 * 用户API路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { UserService } from '@/lib/database/services/UserService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 获取用户信息
 * GET /api/database/users?feishuOpenId=xxx
 */
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const feishuOpenId = searchParams.get('feishuOpenId')
    const userId = searchParams.get('userId')

    if (feishuOpenId) {
      // 根据飞书OpenID获取用户
      const user = await UserService.getUserByFeishuId(feishuOpenId)
      
      if (!user) {
        return NextResponse.json({
          success: false,
          error: '用户不存在'
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        data: {
          user: {
            id: user._id,
            feishuOpenId: user.feishuOpenId,
            profile: user.profile,
            preferences: user.preferences,
            statistics: user.statistics,
            feishuIntegration: {
              isActive: user.feishuIntegration.isActive,
              isConnected: user.isFeishuConnected
            },
            status: user.status,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        }
      })
    }

    if (userId) {
      // 获取用户统计报告
      const report = await UserService.getUserStatsReport(userId)
      
      return NextResponse.json({
        success: true,
        data: { report }
      })
    }

    // 获取活跃用户列表
    const limit = parseInt(searchParams.get('limit') || '50')
    const users = await UserService.getActiveUsers(limit)

    return NextResponse.json({
      success: true,
      data: {
        users: users.map(user => ({
          id: user._id,
          profile: user.profile,
          statistics: {
            totalConversations: user.statistics.totalConversations,
            totalMessages: user.statistics.totalMessages,
            lastActiveAt: user.statistics.lastActiveAt
          },
          feishuIntegration: {
            isActive: user.feishuIntegration.isActive
          }
        })),
        total: users.length
      }
    })

  } catch (error) {
    console.error('❌ 获取用户信息失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取用户信息失败'
    }, { status: 500 })
  }
})

/**
 * 创建或更新用户
 * POST /api/database/users
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { feishuData, preferences, integrationData } = body

    if (!feishuData || !feishuData.openId || !feishuData.userId || !feishuData.name) {
      return NextResponse.json({
        success: false,
        error: '缺少必要的飞书用户信息'
      }, { status: 400 })
    }

    // 创建或更新用户
    const user = await UserService.findOrCreateUser(feishuData)

    // 更新偏好设置
    if (preferences) {
      await UserService.updateUserPreferences(user._id, preferences)
    }

    // 更新飞书集成信息
    if (integrationData) {
      await UserService.updateFeishuIntegration(user._id, integrationData)
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          feishuOpenId: user.feishuOpenId,
          profile: user.profile,
          preferences: user.preferences,
          statistics: user.statistics,
          status: user.status
        }
      }
    })

  } catch (error) {
    console.error('❌ 创建/更新用户失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '创建/更新用户失败'
    }, { status: 500 })
  }
})

/**
 * 更新用户信息
 * PUT /api/database/users
 */
export const PUT = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { userId, preferences, stats, integrationData } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    let updatedUser = null

    // 更新偏好设置
    if (preferences) {
      updatedUser = await UserService.updateUserPreferences(userId, preferences)
    }

    // 更新统计信息
    if (stats) {
      await UserService.updateUserStats(userId, stats)
    }

    // 更新飞书集成信息
    if (integrationData) {
      updatedUser = await UserService.updateFeishuIntegration(userId, integrationData)
    }

    if (!updatedUser) {
      // 如果只更新了统计信息，重新获取用户
      updatedUser = await UserService.getUserByFeishuId(body.feishuOpenId)
    }

    return NextResponse.json({
      success: true,
      data: {
        user: updatedUser ? {
          id: updatedUser._id,
          profile: updatedUser.profile,
          preferences: updatedUser.preferences,
          statistics: updatedUser.statistics,
          feishuIntegration: updatedUser.feishuIntegration
        } : null
      }
    })

  } catch (error) {
    console.error('❌ 更新用户信息失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '更新用户信息失败'
    }, { status: 500 })
  }
})

/**
 * 删除用户
 * DELETE /api/database/users?userId=xxx
 */
export const DELETE = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    const deleted = await UserService.deleteUser(userId)

    if (!deleted) {
      return NextResponse.json({
        success: false,
        error: '用户不存在或删除失败'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })

  } catch (error) {
    console.error('❌ 删除用户失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '删除用户失败'
    }, { status: 500 })
  }
})
