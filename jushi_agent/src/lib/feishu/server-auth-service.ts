/**
 * 服务器端飞书认证服务
 * 用于API路由中的认证，不依赖localStorage
 */

import { NextRequest } from 'next/server'
import { FEISHU_CONFIG } from './config'

export class ServerFeishuAuthService {
  /**
   * 从请求中获取用户访问令牌
   * 支持多种方式：Cookie、Header、Query参数
   */
  static async getUserAccessToken(request: NextRequest): Promise<string | null> {
    try {
      // 1. 从Cookie中获取
      const cookieToken = request.cookies.get('feishu_access_token')?.value
      if (cookieToken) {
        console.log('✅ 从Cookie获取到飞书访问令牌')
        return cookieToken
      }

      // 2. 从Authorization Header中获取
      const authHeader = request.headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7)
        console.log('✅ 从Authorization Header获取到飞书访问令牌')
        return token
      }

      // 3. 从Query参数中获取（用于测试）
      const queryToken = request.nextUrl.searchParams.get('feishu_token')
      if (queryToken) {
        console.log('✅ 从Query参数获取到飞书访问令牌')
        return queryToken
      }

      console.warn('⚠️ 未找到飞书访问令牌')
      return null

    } catch (error) {
      console.error('❌ 获取飞书访问令牌失败:', error)
      return null
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
      console.error('❌ 验证飞书令牌失败:', error)
      return false
    }
  }

  /**
   * 获取用户信息
   */
  static async getUserInfo(token: string): Promise<any> {
    try {
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
      console.error('❌ 获取飞书用户信息失败:', error)
      throw error
    }
  }

  /**
   * 检查用户是否已登录
   */
  static async isUserLoggedIn(request: NextRequest): Promise<boolean> {
    const token = await this.getUserAccessToken(request)
    if (!token) return false

    return await this.validateToken(token)
  }

  /**
   * 获取认证错误响应
   */
  static getAuthErrorResponse() {
    return {
      success: false,
      error: '未找到有效的飞书访问令牌，请先完成飞书登录',
      code: 401,
      suggestion: '请点击"飞书登录"按钮完成登录'
    }
  }
}
