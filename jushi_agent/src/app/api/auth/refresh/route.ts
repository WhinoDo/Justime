/**
 * 刷新令牌API
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/AuthService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 刷新访问令牌
 * POST /api/auth/refresh
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    // 从cookie中获取refresh token
    const refreshToken = request.cookies.get('refresh-token')?.value

    if (!refreshToken) {
      return NextResponse.json({
        success: false,
        error: '未找到刷新令牌'
      }, { status: 401 })
    }

    // 刷新访问令牌
    const result = await AuthService.refreshAccessToken(refreshToken)

    if (result.success) {
      const response = NextResponse.json({
        success: true,
        data: {
          user: {
            id: result.user!._id,
            username: result.user!.username,
            email: result.user!.email,
            displayName: result.user!.displayName,
            profile: result.user!.profile,
            isEmailVerified: result.user!.isEmailVerified,
            hasFeishuBinding: result.user!.hasFeishuBinding,
            feishuBinding: result.user!.feishuBinding,
            role: result.user!.role
          }
        }
      })

      // 设置新的认证cookie
      response.cookies.set('auth-token', result.token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 // 7天
      })

      response.cookies.set('refresh-token', result.refreshToken!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 // 30天
      })

      return response
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 401 })
    }

  } catch (error) {
    console.error('❌ 刷新令牌API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})
