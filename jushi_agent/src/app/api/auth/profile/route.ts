/**
 * 用户资料管理API
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/AuthService'
import { User } from '@/lib/database/models/User'
import { withDatabase } from '@/lib/database/connection'

/**
 * 获取用户资料
 * GET /api/auth/profile
 */
export const GET = withDatabase(async (request: NextRequest) => {
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

    // 获取用户信息
    const user = await User.findById(payload.userId)
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
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          profile: user.profile,
          hasFeishuBinding: user.hasFeishuBinding,
          feishuBinding: user.feishuBinding,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified,
          role: user.role,
          status: user.status,
          statistics: user.statistics,
          lastLoginAt: user.lastLoginAt,
          createdAt: user.createdAt
        }
      }
    })

  } catch (error) {
    console.error('❌ 获取用户资料失败:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})

/**
 * 更新用户资料
 * PUT /api/auth/profile
 */
export const PUT = withDatabase(async (request: NextRequest) => {
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
    const { profile } = body

    if (!profile) {
      return NextResponse.json({
        success: false,
        error: '缺少资料数据'
      }, { status: 400 })
    }

    // 获取用户
    const user = await User.findById(payload.userId)
    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 更新用户资料
    const updatedUser = await User.findByIdAndUpdate(
      payload.userId,
      {
        $set: {
          'profile.displayName': profile.displayName,
          'profile.bio': profile.bio,
          'profile.phone': profile.phone,
          'profile.location': profile.location,
          'profile.website': profile.website,
          'profile.jobTitle': profile.jobTitle,
          'profile.department': profile.department,
          updatedAt: new Date()
        }
      },
      { new: true }
    )

    if (!updatedUser) {
      return NextResponse.json({
        success: false,
        error: '更新用户资料失败'
      }, { status: 500 })
    }

    console.log('✅ 用户资料更新成功:', updatedUser.email)

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          displayName: updatedUser.displayName,
          profile: updatedUser.profile,
          hasFeishuBinding: updatedUser.hasFeishuBinding,
          feishuBinding: updatedUser.feishuBinding,
          isEmailVerified: updatedUser.isEmailVerified,
          isPhoneVerified: updatedUser.isPhoneVerified,
          role: updatedUser.role,
          status: updatedUser.status,
          statistics: updatedUser.statistics,
          lastLoginAt: updatedUser.lastLoginAt,
          createdAt: updatedUser.createdAt
        }
      }
    })

  } catch (error) {
    console.error('❌ 更新用户资料失败:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})
