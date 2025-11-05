/**
 * 用户注册API
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/AuthService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 用户注册
 * POST /api/auth/register
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { username, email, password, displayName, phone } = body

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: '邮箱和密码为必填项'
      }, { status: 400 })
    }

    // 验证邮箱格式
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({
        success: false,
        error: '请输入有效的邮箱地址'
      }, { status: 400 })
    }

    // 验证密码长度
    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: '密码至少需要6个字符'
      }, { status: 400 })
    }

    // 验证用户名格式（如果提供）
    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_-]+$/
      if (!usernameRegex.test(username) || username.length < 3 || username.length > 30) {
        return NextResponse.json({
          success: false,
          error: '用户名只能包含字母、数字、下划线和连字符，长度为3-30个字符'
        }, { status: 400 })
      }
    }

    // 验证手机号格式（如果提供）
    if (phone) {
      const phoneRegex = /^1[3-9]\d{9}$/
      if (!phoneRegex.test(phone)) {
        return NextResponse.json({
          success: false,
          error: '请输入有效的手机号码'
        }, { status: 400 })
      }
    }

    // 执行注册
    const result = await AuthService.register({
      username,
      email,
      password,
      displayName,
      phone
    })

    if (result.success) {
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
            needsVerification: result.needsVerification
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
    console.error('❌ 注册API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})
