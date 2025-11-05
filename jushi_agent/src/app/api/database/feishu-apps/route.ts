/**
 * 飞书应用配置API路由
 */

import { NextRequest, NextResponse } from 'next/server'
import { FeishuAppService } from '@/lib/database/services/FeishuAppService'
import { withDatabase } from '@/lib/database/connection'

/**
 * 获取用户的飞书应用配置
 * GET /api/database/feishu-apps?userId=xxx
 */
export const GET = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    // 获取用户的所有应用和活跃应用
    const [apps, activeApp, stats] = await Promise.all([
      FeishuAppService.getUserApps(userId),
      FeishuAppService.getActiveApp(userId),
      FeishuAppService.getAppStats(userId)
    ])

    // 过滤敏感信息
    const safeApps = apps.map(app => ({
      _id: app._id,
      appId: app.appId,
      appName: app.appName,
      description: app.description,
      permissions: app.permissions,
      status: app.status,
      isVerified: app.isVerified,
      usage: app.usage,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      verification: {
        lastVerified: app.verification.lastVerified,
        errorMessage: app.verification.errorMessage
      }
    }))

    const safeActiveApp = activeApp ? {
      _id: activeApp._id,
      appId: activeApp.appId,
      appName: activeApp.appName,
      description: activeApp.description,
      permissions: activeApp.permissions,
      status: activeApp.status,
      isVerified: activeApp.isVerified
    } : null

    return NextResponse.json({
      success: true,
      data: {
        apps: safeApps,
        activeApp: safeActiveApp,
        stats
      }
    })

  } catch (error) {
    console.error('❌ 获取飞书应用配置失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '获取应用配置失败'
    }, { status: 500 })
  }
})

/**
 * 创建或更新飞书应用配置
 * POST /api/database/feishu-apps
 */
export const POST = withDatabase(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { userId, config } = body

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID'
      }, { status: 400 })
    }

    if (!config || !config.appId || !config.appSecret) {
      return NextResponse.json({
        success: false,
        error: '缺少必要的应用配置信息'
      }, { status: 400 })
    }

    // 验证应用ID格式
    if (!config.appId.startsWith('cli_')) {
      return NextResponse.json({
        success: false,
        error: '应用ID格式错误，应该以 cli_ 开头'
      }, { status: 400 })
    }

    // 验证应用密钥长度
    if (config.appSecret.length < 20) {
      return NextResponse.json({
        success: false,
        error: '应用密钥长度不足，至少需要20个字符'
      }, { status: 400 })
    }

    // 创建或更新应用配置
    const app = await FeishuAppService.createOrUpdateApp(userId, config)

    // 返回安全的应用信息（不包含密钥）
    const safeApp = {
      _id: app._id,
      appId: app.appId,
      appName: app.appName,
      description: app.description,
      permissions: app.permissions,
      status: app.status,
      isVerified: app.isVerified,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt
    }

    return NextResponse.json({
      success: true,
      data: { app: safeApp }
    })

  } catch (error) {
    console.error('❌ 创建/更新飞书应用配置失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '保存应用配置失败'
    }, { status: 500 })
  }
})

/**
 * 删除飞书应用配置
 * DELETE /api/database/feishu-apps?userId=xxx&appId=xxx
 */
export const DELETE = withDatabase(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const appId = searchParams.get('appId')

    if (!userId || !appId) {
      return NextResponse.json({
        success: false,
        error: '缺少用户ID或应用ID'
      }, { status: 400 })
    }

    const deleted = await FeishuAppService.deleteApp(userId, appId)

    if (!deleted) {
      return NextResponse.json({
        success: false,
        error: '应用配置不存在或删除失败'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: { deleted: true }
    })

  } catch (error) {
    console.error('❌ 删除飞书应用配置失败:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '删除应用配置失败'
    }, { status: 500 })
  }
})
