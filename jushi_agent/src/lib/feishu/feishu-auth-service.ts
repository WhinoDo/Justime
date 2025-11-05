/**
 * 飞书认证服务
 * 统一管理飞书用户访问令牌
 */

import { FeishuTokenManager } from './token-manager'
import { QrLoginService } from './qr-login-service'

export class FeishuAuthService {
  /**
   * 获取用户访问令牌
   * 优先从QR登录服务获取，如果没有则从令牌管理器获取
   */
  static async getUserAccessToken(): Promise<string | null> {
    try {
      // 检查是否在浏览器环境
      if (typeof window === 'undefined') {
        console.warn('⚠️ 服务器端环境，无法访问 localStorage')
        return null
      }

      // 尝试从令牌管理器获取有效令牌
      const tokenManager = FeishuTokenManager.getValidAccessToken()
      if (tokenManager) {
        console.log('✅ 从令牌管理器获取到访问令牌')
        return tokenManager
      }

      console.warn('⚠️ 未找到有效的用户访问令牌')
      return null

    } catch (error) {
      console.error('❌ 获取用户访问令牌失败:', error)
      return null
    }
  }

  /**
   * 检查用户是否已登录
   */
  static async isUserLoggedIn(): Promise<boolean> {
    const token = await this.getUserAccessToken()
    return !!token
  }

  /**
   * 获取用户信息
   */
  static async getUserInfo(): Promise<any> {
    try {
      const token = await this.getUserAccessToken()
      if (!token) {
        throw new Error('未找到有效的访问令牌')
      }

      const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`获取用户信息失败: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.code !== 0) {
        throw new Error(`飞书API错误: ${data.msg}`)
      }

      return data.data

    } catch (error) {
      console.error('❌ 获取用户信息失败:', error)
      throw error
    }
  }

  /**
   * 验证令牌有效性
   */
  static async validateToken(token: string): Promise<boolean> {
    try {
      const response = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      return response.ok

    } catch (error) {
      console.error('❌ 验证令牌失败:', error)
      return false
    }
  }
}
