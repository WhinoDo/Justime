/**
 * 获取当前用户信息API
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/AuthService'
import { User } from '@/lib/database/models/User'
import { withDatabase } from '@/lib/database/connection'

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    // 从cookie中获取token
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '未登录'
      }, { status: 401 })
    }

    // 验证token
    const payload = AuthService.verifyToken(token)
    if (!payload) {
      return NextResponse.json({
        success: false,
        error: '无效的认证令牌'
      }, { status: 401 })
    }

    // 获取用户信息
    const user = await User.findById(payload.userId)
    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 更新最后活跃时间
    await user.updateLastActive()

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          profile: user.profile,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          hasFeishuBinding: user.hasFeishuBinding,
          feishuBinding: user.feishuBinding,
          role: user.role,
          status: user.status,
          preferences: user.preferences,
          statistics: user.statistics,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取用户信息API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})
