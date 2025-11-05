/**
 * 动态飞书应用服务
 * 根据用户配置的应用信息动态调用飞书API
 */

import { FeishuAppService } from '@/lib/database/services/FeishuAppService'
import { FeishuTokenManager } from './token-manager'

export class DynamicFeishuAppService {
  /**
   * 获取用户的飞书应用凭据
   */
  static async getUserAppCredentials(userId: string): Promise<{
    appId: string
    appSecret: string
  } | null> {
    try {
      return await FeishuAppService.getAppCredentials(userId)
    } catch (error) {
      console.error('❌ 获取用户应用凭据失败:', error)
      return null
    }
  }

  /**
   * 检查用户是否可以使用飞书API
   */
  static async checkUserApiAccess(userId: string): Promise<{
    canUse: boolean
    reason?: string
    appId?: string
  }> {
    try {
      // 检查使用限制
      const usageCheck = await FeishuAppService.checkUsageLimit(userId)
      if (!usageCheck.canUse) {
        return usageCheck
      }

      // 获取应用凭据
      const credentials = await this.getUserAppCredentials(userId)
      if (!credentials) {
        return {
          canUse: false,
          reason: '未配置飞书应用或应用未激活'
        }
      }

      return {
        canUse: true,
        appId: credentials.appId
      }

    } catch (error) {
      console.error('❌ 检查用户API访问权限失败:', error)
      return {
        canUse: false,
        reason: '检查API访问权限时发生错误'
      }
    }
  }

  /**
   * 使用用户配置的应用获取访问令牌
   */
  static async getUserAppToken(userId: string): Promise<string | null> {
    try {
      const credentials = await this.getUserAppCredentials(userId)
      if (!credentials) {
        console.error('❌ 用户未配置飞书应用')
        return null
      }

      // 这里应该使用用户的应用凭据获取令牌
      // 暂时返回现有的令牌管理器结果
      // 实际实现时需要为每个用户的应用单独管理令牌
      const token = FeishuTokenManager.getValidAccessToken()
      
      if (token) {
        // 更新应用使用统计
        await FeishuAppService.updateUsage(userId, credentials.appId)
      }

      return token

    } catch (error) {
      console.error('❌ 获取用户应用令牌失败:', error)
      return null
    }
  }

  /**
   * 使用用户配置的应用调用飞书日历API
   */
  static async callCalendarAPI(
    userId: string,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    try {
      // 检查API访问权限
      const accessCheck = await this.checkUserApiAccess(userId)
      if (!accessCheck.canUse) {
        throw new Error(accessCheck.reason || '无法访问飞书API')
      }

      // 获取用户应用令牌
      const token = await this.getUserAppToken(userId)
      if (!token) {
        throw new Error('无法获取有效的访问令牌')
      }

      // 调用API
      const baseUrl = 'https://open.feishu.cn/open-apis'
      const url = `${baseUrl}${endpoint}`

      const options: RequestInit = {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }

      if (data && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(data)
      }

      const response = await fetch(url, options)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(`API调用失败: ${result.msg || response.statusText}`)
      }

      return result

    } catch (error) {
      console.error('❌ 调用飞书日历API失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的日历列表
   */
  static async getUserCalendars(userId: string): Promise<any> {
    try {
      return await this.callCalendarAPI(userId, '/calendar/v4/calendars')
    } catch (error) {
      console.error('❌ 获取用户日历列表失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的日历事件
   */
  static async getUserCalendarEvents(
    userId: string,
    calendarId: string,
    startTime?: string,
    endTime?: string
  ): Promise<any> {
    try {
      let endpoint = `/calendar/v4/calendars/${calendarId}/events`
      
      const params = new URLSearchParams()
      if (startTime) params.append('start_time', startTime)
      if (endTime) params.append('end_time', endTime)
      
      if (params.toString()) {
        endpoint += `?${params.toString()}`
      }

      return await this.callCalendarAPI(userId, endpoint)
    } catch (error) {
      console.error('❌ 获取用户日历事件失败:', error)
      throw error
    }
  }

  /**
   * 创建日历事件
   */
  static async createCalendarEvent(
    userId: string,
    calendarId: string,
    eventData: any
  ): Promise<any> {
    try {
      const endpoint = `/calendar/v4/calendars/${calendarId}/events`
      return await this.callCalendarAPI(userId, endpoint, 'POST', eventData)
    } catch (error) {
      console.error('❌ 创建日历事件失败:', error)
      throw error
    }
  }

  /**
   * 更新日历事件
   */
  static async updateCalendarEvent(
    userId: string,
    calendarId: string,
    eventId: string,
    eventData: any
  ): Promise<any> {
    try {
      const endpoint = `/calendar/v4/calendars/${calendarId}/events/${eventId}`
      return await this.callCalendarAPI(userId, endpoint, 'PUT', eventData)
    } catch (error) {
      console.error('❌ 更新日历事件失败:', error)
      throw error
    }
  }

  /**
   * 删除日历事件
   */
  static async deleteCalendarEvent(
    userId: string,
    calendarId: string,
    eventId: string
  ): Promise<any> {
    try {
      const endpoint = `/calendar/v4/calendars/${calendarId}/events/${eventId}`
      return await this.callCalendarAPI(userId, endpoint, 'DELETE')
    } catch (error) {
      console.error('❌ 删除日历事件失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的主日历ID
   */
  static async getUserPrimaryCalendarId(userId: string): Promise<string | null> {
    try {
      const calendars = await this.getUserCalendars(userId)
      
      if (calendars.data?.calendar_list) {
        const primaryCalendar = calendars.data.calendar_list.find(
          (cal: any) => cal.type === 'primary'
        )
        return primaryCalendar?.calendar_id || null
      }

      return null

    } catch (error) {
      console.error('❌ 获取用户主日历ID失败:', error)
      return null
    }
  }

  /**
   * 检查用户应用状态并提供建议
   */
  static async getUserAppStatus(userId: string): Promise<{
    hasApp: boolean
    isActive: boolean
    canUseCalendar: boolean
    suggestions: string[]
    appInfo?: any
  }> {
    try {
      const activeApp = await FeishuAppService.getActiveApp(userId)
      const usageCheck = await FeishuAppService.checkUsageLimit(userId)

      const suggestions: string[] = []

      if (!activeApp) {
        suggestions.push('请先配置飞书应用信息')
        suggestions.push('访问"飞书应用配置"页面添加应用')
        return {
          hasApp: false,
          isActive: false,
          canUseCalendar: false,
          suggestions
        }
      }

      if (!activeApp.isVerified) {
        suggestions.push('应用配置需要验证')
        suggestions.push('点击"激活"按钮验证应用配置')
      }

      if (!activeApp.permissions.calendar) {
        suggestions.push('应用缺少日历权限')
        suggestions.push('请在飞书开放平台为应用开通日历权限')
      }

      if (!usageCheck.canUse) {
        suggestions.push(usageCheck.reason || '已达到使用限制')
      }

      const canUseCalendar = activeApp.isVerified && 
                           activeApp.permissions.calendar && 
                           usageCheck.canUse

      return {
        hasApp: true,
        isActive: activeApp.status === 'active',
        canUseCalendar,
        suggestions,
        appInfo: {
          appId: activeApp.appId,
          appName: activeApp.appName,
          permissions: activeApp.permissions,
          usage: activeApp.usage
        }
      }

    } catch (error) {
      console.error('❌ 检查用户应用状态失败:', error)
      return {
        hasApp: false,
        isActive: false,
        canUseCalendar: false,
        suggestions: ['检查应用状态时发生错误，请稍后重试']
      }
    }
  }
}

export default DynamicFeishuAppService
