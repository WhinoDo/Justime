/**
 * 取消飞书应用授权API
 * 撤销应用访问权限，但保留绑定关系
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth/AuthService'
import { User } from '@/lib/database/models/User'
import { withDatabase } from '@/lib/database/connection'

/**
 * 取消飞书应用授权
 * POST /api/auth/revoke-feishu
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    // 验证用户身份
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({
        success: false,
        error: '请先登录'
      }, { status: 401 })
    }

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
    if (!user.feishuBinding || !user.feishuBinding.isActive) {
      return NextResponse.json({
        success: false,
        error: '您尚未绑定飞书账号或绑定已失效'
      }, { status: 400 })
    }

    console.log('🔐 开始取消飞书应用授权:', {
      userId: user._id,
      email: user.email,
      feishuOpenId: user.feishuBinding.openId
    })

    // 如果有访问令牌，尝试调用飞书API撤销授权
    if (user.feishuBinding.integration?.accessToken) {
      try {
        await revokeFeishuToken(user.feishuBinding.integration.accessToken)
        console.log('✅ 飞书API授权撤销成功')
      } catch (error) {
        console.warn('⚠️ 飞书API授权撤销失败，继续本地撤销:', error)
        // 即使API撤销失败，也继续本地撤销
      }
    }

    // 清除集成信息，但保留绑定关系
    if (user.feishuBinding.integration) {
      user.feishuBinding.integration = {
        accessToken: undefined,
        refreshToken: undefined,
        tokenExpiresAt: undefined,
        calendarId: user.feishuBinding.integration.calendarId, // 保留日历ID
        isActive: false // 设为非活跃状态
      }
    }

    // 更新最后同步时间
    user.feishuBinding.lastSyncTime = new Date()

    await user.save()

    console.log('✅ 用户飞书应用授权取消成功:', user.email)

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
    console.error('❌ 取消飞书应用授权API错误:', error)
    return NextResponse.json({
      success: false,
      error: '服务器内部错误'
    }, { status: 500 })
  }
})

/**
 * 调用飞书API撤销访问令牌
 */
async function revokeFeishuToken(accessToken: string): Promise<void> {
  try {
    // 调用飞书撤销令牌API
    const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/revoke', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (data.code !== 0) {
      throw new Error(`飞书API撤销失败: ${data.msg}`)
    }

    console.log('✅ 飞书访问令牌撤销成功')

  } catch (error) {
    console.error('❌ 撤销飞书访问令牌失败:', error)
    throw error
  }
}

/**
 * 重新授权飞书应用
 * PUT /api/auth/revoke-feishu
 */
export const PUT = withDatabase(async (request: NextRequest) => {
  try {
    // 验证用户身份
    const token = request.cookies.get('auth-token')?.value
    if (!token) {
      return NextResponse.json({
        success: false,
        error: '请先登录'
      }, { status: 401 })
    }

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
    if (!user.feishuBinding || !user.feishuBinding.isActive) {
      return NextResponse.json({
        success: false,
        error: '您尚未绑定飞书账号'
      }, { status: 400 })
    }

    // 生成重新授权URL
    const authUrl = await generateReauthorizeUrl(user._id.toString())

    return NextResponse.json({
      success: true,
      data: {
        authUrl,
        message: '请访问授权链接重新授权飞书应用'
      }
    })

  } catch (error) {
    console.error('❌ 生成重新授权链接失败:', error)
    return NextResponse.json({
      success: false,
      error: '生成授权链接失败'
    }, { status: 500 })
  }
})

/**
 * 生成重新授权URL
 */
async function generateReauthorizeUrl(userId: string): Promise<string> {
  // 这里可以调用动态配置服务生成授权URL
  // 暂时返回一个示例URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.0.101:3001'
  const state = encodeURIComponent(JSON.stringify({
    action: 'reauthorize',
    userId,
    timestamp: Date.now()
  }))
  
  return `${baseUrl}/api/feishu/qr-login/init?action=reauthorize&userId=${userId}&state=${state}`
}
