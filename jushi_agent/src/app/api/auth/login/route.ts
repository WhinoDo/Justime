/**
 * 用户登录API
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/AuthService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 用户登录
 * POST /api/auth/login
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { identifier, password, rememberMe } = body

    // 验证必填字段
    if (!identifier || !password) {
      return NextResponse.json({
        success: false,
        error: '用户名/邮箱和密码为必填项'
      }, { status: 400 })
    }

    // 获取客户端IP
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown'

    // 执行登录
    const result = await AuthService.login({
      identifier,
      password,
      rememberMe
    })

    if (result.success) {
      // 更新用户登录IP
      if (result.user) {
        result.user.lastLoginIP = clientIP
        await result.user.save()
      }

      // 设置HTTP-only cookie
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
            role: result.user!.role,
            lastLoginAt: result.user!.lastLoginAt
          }
        }
      })

      // 设置认证cookie
      const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60 // 记住我30天，否则7天
      
      response.cookies.set('auth-token', result.token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge
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
    console.error('❌ 登录API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})
