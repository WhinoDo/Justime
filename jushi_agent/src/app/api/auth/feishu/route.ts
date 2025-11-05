/**
 * 飞书登录/绑定API
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/AuthService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 飞书登录/绑定
 * POST /api/auth/feishu
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { openId, unionId, name, avatar, email, mobile, bindToExisting, existingUserId } = body

    // 验证必填字段
    if (!openId || !name) {
      return NextResponse.json({
        success: false,
        error: '缺少必要的飞书用户信息'
      }, { status: 400 })
    }

    let result

    if (bindToExisting && existingUserId) {
      // 绑定到现有账户
      // 这里需要实现绑定逻辑
      // 暂时返回错误，后续实现
      return NextResponse.json({
        success: false,
        error: '绑定功能暂未实现'
      }, { status: 501 })
    } else {
      // 飞书登录或创建新账户
      result = await AuthService.loginWithFeishu({
        openId,
        unionId,
        name,
        avatar,
        email,
        mobile
      })
    }

    if (result.success) {
      // 获取客户端IP
      const clientIP = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown'

      // 更新用户登录IP
      if (result.user) {
        result.user.lastLoginIP = clientIP
        await result.user.save()
      }

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
            role: result.user!.role,
            lastLoginAt: result.user!.lastLoginAt,
            feishuBinding: result.user!.feishuBinding
          }
        }
      })

      // 设置认证cookie
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
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ 飞书登录API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})
