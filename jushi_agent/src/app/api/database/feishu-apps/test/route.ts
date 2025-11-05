/**
 * 飞书应用配置测试API
 */

import { NextRequest, NextResponse } from 'next/server'
import { FeishuAppService } from '@/lib/database/services/FeishuAppService'

/**
 * 测试飞书应用配置
 * POST /api/database/feishu-apps/test
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { appId, appSecret } = body

    if (!appId || !appSecret) {
      return NextResponse.json({
        success: false,
        error: '缺少应用ID或应用密钥'
      }, { status: 400 })
    }

    // 测试应用配置
    const testResult = await FeishuAppService.testAppConfig(appId, appSecret)

    return NextResponse.json({
      success: true,
      data: testResult
    })

  } catch (error) {
    console.error('❌ 测试飞书应用配置失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '测试应用配置失败'
    }, { status: 500 })
  }
}
