/**
 * 动态飞书登录服务
 * 根据用户配置的飞书应用进行登录
 */

import { DynamicFeishuConfigService } from './dynamic-config'
import { FEISHU_CONFIG } from './config'

export class DynamicFeishuLoginService {
  /**
   * 生成飞书授权URL
   */
  static async generateAuthUrl(userId?: string, state?: string): Promise<string> {
    let config
    
    if (userId) {
      // 尝试获取用户的动态配置
      config = await DynamicFeishuConfigService.getUserConfig(userId)
    }
    
    // 如果没有用户配置，使用默认配置
    if (!config) {
      config = DynamicFeishuConfigService.getDefaultConfig()
    }

    const params = new URLSearchParams({
      app_id: config.CLIENT_ID,
      redirect_uri: config.REDIRECT_URI,
      scope: config.SCOPES.join(' '),
      state: state || 'default'
    })

    return `${config.ENDPOINTS.AUTHORIZE}?${params.toString()}`
  }

  /**
   * 处理授权回调
   */
  static async handleCallback(
    code: string,
    state: string,
    userId?: string
  ): Promise<{
    success: boolean
    userInfo?: any
    error?: string
  }> {
    try {
      let config
      
      if (userId) {
        // 尝试获取用户的动态配置
        config = await DynamicFeishuConfigService.getUserConfig(userId)
      }
      
      // 如果没有用户配置，使用默认配置
      if (!config) {
        config = DynamicFeishuConfigService.getDefaultConfig()
      }

      // 1. 获取访问令牌
      const tokenResponse = await fetch(config.ENDPOINTS.TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: config.CLIENT_ID,
          client_secret: config.CLIENT_SECRET,
          code,
          redirect_uri: config.REDIRECT_URI
        })
      })

      const tokenData = await tokenResponse.json()

      if (tokenData.code !== 0) {
        return {
          success: false,
          error: tokenData.msg || '获取访问令牌失败'
        }
      }

      const accessToken = tokenData.data.access_token

      // 2. 获取用户信息
      const userResponse = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      const userData = await userResponse.json()

      if (userData.code !== 0) {
        return {
          success: false,
          error: userData.msg || '获取用户信息失败'
        }
      }

      const userInfo = {
        openId: userData.data.open_id,
        unionId: userData.data.union_id,
        name: userData.data.name,
        avatar: userData.data.avatar_url,
        email: userData.data.email,
        mobile: userData.data.mobile
      }

      return {
        success: true,
        userInfo
      }

    } catch (error) {
      console.error('处理飞书回调失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '处理回调失败'
      }
    }
  }

  /**
   * 刷新访问令牌
   */
  static async refreshToken(
    refreshToken: string,
    userId?: string
  ): Promise<{
    success: boolean
    accessToken?: string
    newRefreshToken?: string
    error?: string
  }> {
    try {
      let config
      
      if (userId) {
        // 尝试获取用户的动态配置
        config = await DynamicFeishuConfigService.getUserConfig(userId)
      }
      
      // 如果没有用户配置，使用默认配置
      if (!config) {
        config = DynamicFeishuConfigService.getDefaultConfig()
      }

      const response = await fetch(config.ENDPOINTS.TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          client_id: config.CLIENT_ID,
          client_secret: config.CLIENT_SECRET,
          refresh_token: refreshToken
        })
      })

      const data = await response.json()

      if (data.code !== 0) {
        return {
          success: false,
          error: data.msg || '刷新令牌失败'
        }
      }

      return {
        success: true,
        accessToken: data.data.access_token,
        newRefreshToken: data.data.refresh_token
      }

    } catch (error) {
      console.error('刷新飞书令牌失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '刷新令牌失败'
      }
    }
  }

  /**
   * 获取应用访问令牌（用于调用飞书API）
   */
  static async getAppAccessToken(userId?: string): Promise<string | null> {
    try {
      let config
      
      if (userId) {
        // 尝试获取用户的动态配置
        config = await DynamicFeishuConfigService.getUserConfig(userId)
      }
      
      // 如果没有用户配置，使用默认配置
      if (!config) {
        config = DynamicFeishuConfigService.getDefaultConfig()
      }

      return await DynamicFeishuConfigService.getAppAccessToken(config)

    } catch (error) {
      console.error('获取应用访问令牌失败:', error)
      return null
    }
  }

  /**
   * 验证用户是否有有效的飞书应用配置
   */
  static async hasValidConfig(userId: string): Promise<boolean> {
    try {
      const config = await DynamicFeishuConfigService.getUserConfig(userId)
      return config !== null
    } catch (error) {
      console.error('检查飞书配置失败:', error)
      return false
    }
  }

  /**
   * 获取用户的飞书应用信息
   */
  static async getUserAppInfo(userId: string): Promise<{
    hasCustomApp: boolean
    appId?: string
    appName?: string
    permissions?: any
  }> {
    try {
      const config = await DynamicFeishuConfigService.getUserConfig(userId)
      
      if (!config) {
        return {
          hasCustomApp: false
        }
      }

      // 这里可以从数据库获取更详细的应用信息
      // 暂时返回基本信息
      return {
        hasCustomApp: true,
        appId: config.CLIENT_ID,
        permissions: {
          calendar: config.SCOPES.some(scope => scope.includes('calendar')),
          contacts: config.SCOPES.some(scope => scope.includes('contact')),
          messages: config.SCOPES.some(scope => scope.includes('im')),
          documents: config.SCOPES.some(scope => scope.includes('docs') || scope.includes('drive'))
        }
      }

    } catch (error) {
      console.error('获取用户飞书应用信息失败:', error)
      return {
        hasCustomApp: false
      }
    }
  }
}

export default DynamicFeishuLoginService
