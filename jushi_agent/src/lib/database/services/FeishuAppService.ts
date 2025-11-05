/**
 * 飞书应用服务层
 */

import { FeishuApp, IFeishuApp } from '../models/FeishuApp'
import { ensureDbConnection } from '../connection'

export interface FeishuAppConfig {
  appId: string
  appSecret: string
  appName?: string
  description?: string
  permissions?: {
    calendar?: boolean
    contacts?: boolean
    messages?: boolean
    documents?: boolean
  }
}

export class FeishuAppService {
  /**
   * 为用户创建或更新飞书应用配置
   */
  static async createOrUpdateApp(
    userId: string,
    config: FeishuAppConfig
  ): Promise<IFeishuApp> {
    await ensureDbConnection()

    try {
      // 先停用用户的其他应用
      await FeishuApp.updateMany(
        { userId, status: 'active' },
        { status: 'inactive' }
      )

      // 查找是否已存在相同的应用配置
      let app = await FeishuApp.findOne({ userId, appId: config.appId })

      if (app) {
        // 更新现有应用
        app.appSecret = config.appSecret // 会在save时自动加密
        app.appName = config.appName || app.appName
        app.description = config.description || app.description
        app.permissions = { ...app.permissions, ...config.permissions }
        app.status = 'inactive' // 需要重新验证
        app.isVerified = false
      } else {
        // 创建新应用
        app = new FeishuApp({
          userId,
          appId: config.appId,
          appSecret: config.appSecret, // 会在save时自动加密
          appName: config.appName || '我的飞书应用',
          description: config.description || '用户自定义飞书应用',
          permissions: {
            calendar: true,
            contacts: false,
            messages: false,
            documents: false,
            ...config.permissions
          },
          status: 'inactive',
          isVerified: false,
          usage: {
            totalApiCalls: 0,
            dailyLimit: 1000,
            monthlyLimit: 10000
          }
        })
      }

      await app.save()
      console.log('✅ 飞书应用配置已保存:', config.appId)
      return app

    } catch (error) {
      console.error('❌ 创建/更新飞书应用失败:', error)
      throw new Error('保存飞书应用配置失败')
    }
  }

  /**
   * 验证飞书应用配置
   */
  static async verifyApp(userId: string, appId: string): Promise<boolean> {
    await ensureDbConnection()

    try {
      const app = await FeishuApp.findOne({ userId, appId })
      if (!app) {
        throw new Error('应用配置不存在')
      }

      // 调用应用的验证方法
      const isValid = await app.verify()
      
      if (isValid) {
        console.log('✅ 飞书应用验证成功:', appId)
      } else {
        console.log('❌ 飞书应用验证失败:', appId)
      }

      return isValid

    } catch (error) {
      console.error('❌ 验证飞书应用失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的活跃飞书应用
   */
  static async getActiveApp(userId: string): Promise<IFeishuApp | null> {
    await ensureDbConnection()

    try {
      const app = await FeishuApp.findActiveByUserId(userId)
      
      if (app && app.isExpired) {
        // 如果应用已过期，标记为过期状态
        app.status = 'expired'
        await app.save()
        return null
      }

      return app

    } catch (error) {
      console.error('❌ 获取活跃飞书应用失败:', error)
      return null
    }
  }

  /**
   * 获取用户的所有飞书应用
   */
  static async getUserApps(userId: string): Promise<IFeishuApp[]> {
    await ensureDbConnection()

    try {
      return await FeishuApp.findByUserId(userId)

    } catch (error) {
      console.error('❌ 获取用户飞书应用列表失败:', error)
      return []
    }
  }

  /**
   * 删除飞书应用配置
   */
  static async deleteApp(userId: string, appId: string): Promise<boolean> {
    await ensureDbConnection()

    try {
      const result = await FeishuApp.deleteOne({ userId, appId })
      
      if (result.deletedCount > 0) {
        console.log('✅ 飞书应用已删除:', appId)
        return true
      }

      return false

    } catch (error) {
      console.error('❌ 删除飞书应用失败:', error)
      throw error
    }
  }

  /**
   * 获取应用的解密密钥（仅用于API调用）
   */
  static async getAppCredentials(userId: string): Promise<{
    appId: string
    appSecret: string
  } | null> {
    await ensureDbConnection()

    try {
      const app = await this.getActiveApp(userId)
      if (!app) {
        return null
      }

      return {
        appId: app.appId,
        appSecret: app.getDecryptedSecret()
      }

    } catch (error) {
      console.error('❌ 获取应用凭据失败:', error)
      return null
    }
  }

  /**
   * 更新应用使用统计
   */
  static async updateUsage(userId: string, appId: string): Promise<void> {
    await ensureDbConnection()

    try {
      const app = await FeishuApp.findOne({ userId, appId })
      if (app) {
        await app.updateUsage()
      }

    } catch (error) {
      console.error('❌ 更新应用使用统计失败:', error)
    }
  }

  /**
   * 检查应用是否达到使用限制
   */
  static async checkUsageLimit(userId: string): Promise<{
    canUse: boolean
    reason?: string
    remainingDaily?: number
    remainingMonthly?: number
  }> {
    await ensureDbConnection()

    try {
      const app = await this.getActiveApp(userId)
      if (!app) {
        return { canUse: false, reason: '没有活跃的飞书应用配置' }
      }

      // 简化的限制检查逻辑
      const dailyRemaining = app.remainingDailyLimit
      
      if (dailyRemaining <= 0) {
        return { 
          canUse: false, 
          reason: '已达到每日API调用限制',
          remainingDaily: 0
        }
      }

      return { 
        canUse: true, 
        remainingDaily: dailyRemaining 
      }

    } catch (error) {
      console.error('❌ 检查使用限制失败:', error)
      return { canUse: false, reason: '检查使用限制时发生错误' }
    }
  }

  /**
   * 测试应用配置是否有效
   */
  static async testAppConfig(appId: string, appSecret: string): Promise<{
    isValid: boolean
    error?: string
    permissions?: string[]
  }> {
    try {
      // 这里应该调用飞书API进行实际验证
      // 暂时返回模拟结果
      
      if (!appId || !appId.startsWith('cli_')) {
        return { 
          isValid: false, 
          error: '无效的应用ID格式，应该以 cli_ 开头' 
        }
      }

      if (!appSecret || appSecret.length < 20) {
        return { 
          isValid: false, 
          error: '应用密钥长度不足，至少需要20个字符' 
        }
      }

      // 模拟API调用验证
      // 实际实现时应该调用飞书的应用信息API
      return {
        isValid: true,
        permissions: ['calendar:read', 'calendar:write']
      }

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : '验证应用配置时发生未知错误'
      }
    }
  }

  /**
   * 获取应用统计信息
   */
  static async getAppStats(userId: string): Promise<{
    totalApps: number
    activeApps: number
    totalApiCalls: number
    lastUsed?: Date
  }> {
    await ensureDbConnection()

    try {
      const apps = await this.getUserApps(userId)
      const activeApps = apps.filter(app => app.status === 'active')
      const totalApiCalls = apps.reduce((sum, app) => sum + app.usage.totalApiCalls, 0)
      const lastUsed = apps.reduce((latest, app) => {
        if (!app.usage.lastUsed) return latest
        if (!latest) return app.usage.lastUsed
        return app.usage.lastUsed > latest ? app.usage.lastUsed : latest
      }, null as Date | null)

      return {
        totalApps: apps.length,
        activeApps: activeApps.length,
        totalApiCalls,
        lastUsed: lastUsed || undefined
      }

    } catch (error) {
      console.error('❌ 获取应用统计失败:', error)
      return {
        totalApps: 0,
        activeApps: 0,
        totalApiCalls: 0
      }
    }
  }
}

export default FeishuAppService
