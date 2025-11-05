/**
 * 飞书应用验证API
 */

import { NextRequest, NextResponse } from 'next/server'
import { FeishuAppService } from '@/lib/database/services/FeishuAppService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 验证并激活飞书应用
 * POST /api/database/feishu-apps/verify
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { userId, appId } = body

    if (!userId || !appId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID或应用ID'
      }, { status: 400 })
    }

    // 验证应用配置
    const isValid = await FeishuAppService.verifyApp(userId, appId)

    if (isValid) {
      return NextResponse.json({
        success: true,
        data: { verified: true, message: '应用验证成功并已激活' }
      })
    } else {
      return NextResponse.json({
        success: false,
        error: '应用验证失败，请检查应用配置'
      }, { status: 400 })
    }

  } catch (error) {
    console.error('❌ 验证飞书应用失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '验证应用失败'
    }, { status: 500 })
  }
})
