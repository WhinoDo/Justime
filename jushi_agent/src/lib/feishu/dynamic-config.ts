/**
 * 动态飞书配置服务
 * 根据用户的飞书应用配置动态生成配置
 */

import { FeishuApp } from '@/lib/database/models/FeishuApp'
import { FEISHU_CONFIG } from './config'

export interface DynamicFeishuConfig {
  CLIENT_ID: string
  CLIENT_SECRET: string
  REDIRECT_URI: string
  QR_REDIRECT_URI: string
  ENDPOINTS: typeof FEISHU_CONFIG.ENDPOINTS
  SCOPES: string[]
}

export class DynamicFeishuConfigService {
  /**
   * 获取用户的动态飞书配置
   */
  static async getUserConfig(userId: string): Promise<DynamicFeishuConfig | null> {
    try {
      // 获取用户的活跃飞书应用配置
      const app = await FeishuApp.findActiveByUserId(userId)
      
      if (!app || !app.isVerified) {
        console.log(`用户 ${userId} 没有有效的飞书应用配置，使用默认配置`)
        return null
      }

      // 解密应用密钥
      const decryptedSecret = app.getDecryptedSecret()

      // 根据应用权限生成作用域
      const scopes = this.generateScopes(app.permissions)

      // 生成动态配置
      const config: DynamicFeishuConfig = {
        CLIENT_ID: app.appId,
        CLIENT_SECRET: decryptedSecret,
        REDIRECT_URI: this.generateRedirectUri(app.appId),
        QR_REDIRECT_URI: this.generateQRRedirectUri(app.appId),
        ENDPOINTS: FEISHU_CONFIG.ENDPOINTS,
        SCOPES: scopes
      }

      console.log(`✅ 为用户 ${userId} 生成动态飞书配置:`, {
        appId: app.appId,
        appName: app.appName,
        scopesCount: scopes.length
      })

      // 更新使用统计
      await app.updateUsage()

      return config

    } catch (error) {
      console.error('❌ 获取用户飞书配置失败:', error)
      return null
    }
  }

  /**
   * 获取默认配置（用于未配置自定义应用的用户）
   */
  static getDefaultConfig(): DynamicFeishuConfig {
    return {
      CLIENT_ID: FEISHU_CONFIG.CLIENT_ID,
      CLIENT_SECRET: FEISHU_CONFIG.CLIENT_SECRET,
      REDIRECT_URI: FEISHU_CONFIG.REDIRECT_URI,
      QR_REDIRECT_URI: FEISHU_CONFIG.QR_REDIRECT_URI,
      ENDPOINTS: FEISHU_CONFIG.ENDPOINTS,
      SCOPES: FEISHU_CONFIG.SCOPES
    }
  }

  /**
   * 根据权限配置生成作用域
   */
  private static generateScopes(permissions: any): string[] {
    const scopes: string[] = ['offline_access'] // 基础权限

    if (permissions.calendar) {
      scopes.push(
        'calendar:calendar',
        'calendar:calendar.acl:create',
        'calendar:calendar.acl:delete',
        'calendar:calendar.acl:read',
        'calendar:calendar.event:create',
        'calendar:calendar.free_busy:read',
        'calendar:calendar:create',
        'calendar:calendar:delete',
        'calendar:calendar:read',
        'calendar:calendar:readonly',
        'calendar:calendar:subscribe',
        'calendar:calendar:update'
      )
    }

    if (permissions.contacts) {
      scopes.push(
        'contact:contact.base:readonly',
        'contact:user.assign_info:read',
        'contact:user.base:readonly',
        'contact:user.department:readonly',
        'contact:user.department_path:readonly',
        'contact:user.dotted_line_leader_info.read',
        'contact:user.email:readonly',
        'contact:user.employee:readonly',
        'contact:user.employee_id:readonly',
        'contact:user.employee_number:read',
        'contact:user.gender:readonly',
        'contact:user.job_family:readonly',
        'contact:user.job_level:readonly',
        'contact:user.phone:readonly',
        'contact:user.user_geo',
        'directory:employee.base.email:read'
      )
    }

    if (permissions.messages) {
      scopes.push(
        'im:message',
        'im:message:send_as_bot',
        'im:chat:readonly'
      )
    }

    if (permissions.documents) {
      scopes.push(
        'docs:doc:readonly',
        'docs:sheet:readonly',
        'drive:drive:readonly'
      )
    }

    // 添加基础用户信息权限
    scopes.push('passport:session_mask:readonly')

    return scopes
  }

  /**
   * 生成重定向URI
   */
  private static generateRedirectUri(appId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.1.4:3000'
    return `${baseUrl}/api/feishu/callback/${appId}`
  }

  /**
   * 生成二维码重定向URI
   */
  private static generateQRRedirectUri(appId: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://192.168.1.4:3000'
    return `${baseUrl}/api/feishu/qr-callback/${appId}`
  }

  /**
   * 验证飞书应用配置是否有效
   */
  static async validateAppConfig(appId: string, appSecret: string): Promise<{
    isValid: boolean
    error?: string
  }> {
    try {
      // 调用飞书API获取应用访问令牌来验证配置
      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: appId,
          app_secret: appSecret
        })
      })

      const data = await response.json()

      if (data.code === 0 && data.app_access_token) {
        return { isValid: true }
      } else {
        return {
          isValid: false,
          error: data.msg || '应用配置验证失败'
        }
      }

    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : '网络请求失败'
      }
    }
  }

  /**
   * 获取应用访问令牌
   */
  static async getAppAccessToken(config: DynamicFeishuConfig): Promise<string | null> {
    try {
      const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: config.CLIENT_ID,
          app_secret: config.CLIENT_SECRET
        })
      })

      const data = await response.json()

      if (data.code === 0 && data.app_access_token) {
        return data.app_access_token
      } else {
        console.error('获取应用访问令牌失败:', data)
        return null
      }

    } catch (error) {
      console.error('获取应用访问令牌异常:', error)
      return null
    }
  }
}

export default DynamicFeishuConfigService
