/**
 * 绑定飞书账号API
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/AuthService'
import { User } from '@/lib/database/models/User'
import { withDatabase } from '@/lib/database/connection'

/**
 * 绑定飞书账号到现有用户
 * POST /api/auth/bind-feishu
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    // 从cookie中获取token验证用户身份
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '请先登录'
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

    const body = await request.json()
    const { openId, unionId, name, avatar, email, mobile } = body

    console.log('📥 收到绑定请求数据:', {
      openId: openId ? `${openId.substring(0, 10)}...` : 'undefined',
      unionId: unionId ? `${unionId.substring(0, 10)}...` : 'undefined',
      name,
      hasAvatar: !!avatar,
      email,
      mobile
    })

    // 验证必填字段
    if (!openId || !name) {
      console.error('❌ 绑定失败 - 缺少必要字段:', {
        hasOpenId: !!openId,
        hasName: !!name,
        receivedFields: Object.keys(body)
      })
      return NextResponse.json({
        success: false,
        error: '缺少必要的飞书用户信息',
        details: {
          missingOpenId: !openId,
          missingName: !name,
          receivedFields: Object.keys(body)
        }
      }, { status: 400 })
    }

    // 获取当前用户
    const user = await User.findById(payload.userId)
    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 检查飞书账号是否已被其他用户绑定
    const existingFeishuUser = await User.findByFeishuOpenId(openId)
    if (existingFeishuUser && existingFeishuUser._id.toString() !== user._id.toString()) {
      return NextResponse.json({
        success: false,
        error: '该飞书账号已被其他用户绑定'
      }, { status: 400 })
    }

    // 检查当前用户是否已绑定其他飞书账号
    if (user.hasFeishuBinding) {
      return NextResponse.json({
        success: false,
        error: '您已绑定了飞书账号，请先解绑后再绑定新账号'
      }, { status: 400 })
    }

    // 绑定飞书账号
    await user.bindFeishu({
      openId,
      unionId,
      name,
      avatar,
      email,
      mobile
    })

    console.log('✅ 用户绑定飞书账号成功:', user.email, '->', openId)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          profile: user.profile,
          hasFeishuBinding: user.hasFeishuBinding,
          feishuBinding: user.feishuBinding
        }
      }
    })

  } catch (error) {
    console.error('❌ 绑定飞书账号API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})

/**
 * 解绑飞书账号
 * DELETE /api/auth/bind-feishu
 */
export const DELETE = withDatabase(async (request: NextRequest) => {
  try {
    // 从cookie中获取token验证用户身份
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json({
        success: false,
        error: '请先登录'
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

    // 获取当前用户
    const user = await User.findById(payload.userId)
    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 检查是否已绑定飞书账号
    if (!user.hasFeishuBinding) {
      return NextResponse.json({
        success: false,
        error: '您尚未绑定飞书账号'
      }, { status: 400 })
    }

    // 解绑飞书账号
    await user.unbindFeishu()

    console.log('✅ 用户解绑飞书账号成功:', user.email)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          profile: user.profile,
          hasFeishuBinding: user.hasFeishuBinding,
          feishuBinding: user.feishuBinding
        }
      }
    })

  } catch (error) {
    console.error('❌ 解绑飞书账号API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})
