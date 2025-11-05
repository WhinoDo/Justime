/**
 * 飞书日程管理服务
 * 使用保存的 access_token 进行飞书日程相关操作
 */

import { FeishuTokenManager } from './token-manager'

export interface CalendarEvent {
  event_id?: string
  summary: string
  description?: string
  start_time: {
    timestamp: string
    timezone?: string
  }
  end_time: {
    timestamp: string
    timezone?: string
  }
  attendees?: Array<{
    type: 'user' | 'chat' | 'resource' | 'third_party'
    attendee_id: string
    rsvp_status?: 'needs_action' | 'accept' | 'tentative' | 'decline'
  }>
  location?: {
    name?: string
    address?: string
    latitude?: number
    longitude?: number
  }
  visibility?: 'default' | 'public' | 'private'
  attendee_ability?: 'none' | 'can_see_others' | 'can_invite_others' | 'can_modify_event'
  free_busy_status?: 'busy' | 'free'
  reminders?: Array<{
    minutes: number
  }>
}

export interface CalendarListResponse {
  code: number
  msg: string
  data: {
    has_more: boolean
    page_token?: string
    sync_token?: string
    calendars: Array<{
      calendar_id: string
      summary: string
      description?: string
      permissions: string
      color: number
      type: string
      summary_alias?: string
    }>
  }
}

export interface EventListResponse {
  code: number
  msg: string
  data: {
    has_more: boolean
    page_token?: string
    sync_token?: string
    items: CalendarEvent[]
  }
}

export class FeishuCalendarService {
  private static readonly BASE_URL = 'https://open.feishu.cn/open-apis'

  /**
   * 检查是否有有效的登录状态
   */
  private static checkAuth(): { isValid: boolean; authHeader?: { Authorization: string } } {
    if (!FeishuTokenManager.isLoggedIn()) {
      return { isValid: false }
    }

    const authHeader = FeishuTokenManager.getAuthHeader()
    if (!authHeader) {
      return { isValid: false }
    }

    return { isValid: true, authHeader }
  }

  /**
   * 发送API请求的通用方法
   */
  private static async apiRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const { isValid, authHeader } = this.checkAuth()
    if (!isValid) {
      throw new Error('用户未登录或登录已过期，请重新登录')
    }

    const url = `${this.BASE_URL}${endpoint}`
    const headers = {
      'Content-Type': 'application/json',
      ...authHeader,
      ...options.headers
    }

    console.log(`🔗 调用飞书API: ${options.method || 'GET'} ${endpoint}`)

    const response = await fetch(url, {
      ...options,
      headers
    })

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    
    if (data.code !== 0) {
      throw new Error(`飞书API错误: ${data.msg} (code: ${data.code})`)
    }

    return data
  }

  /**
   * 获取日历列表
   */
  static async getCalendarList(pageSize: number = 50): Promise<CalendarListResponse> {
    return this.apiRequest<CalendarListResponse>(
      `/calendar/v4/calendars?page_size=${pageSize}`
    )
  }

  /**
   * 获取主日历ID
   */
  static async getPrimaryCalendarId(): Promise<string> {
    const calendars = await this.getCalendarList()
    
    // 查找主日历（通常是第一个或者类型为primary的）
    const primaryCalendar = calendars.data.calendars.find(
      cal => cal.type === 'primary' || cal.permissions.includes('owner')
    ) || calendars.data.calendars[0]

    if (!primaryCalendar) {
      throw new Error('未找到可用的日历')
    }

    return primaryCalendar.calendar_id
  }

  /**
   * 获取日程列表
   */
  static async getEvents(
    calendarId?: string,
    startTime?: string,
    endTime?: string,
    pageSize: number = 50
  ): Promise<EventListResponse> {
    if (!calendarId) {
      calendarId = await this.getPrimaryCalendarId()
    }

    let endpoint = `/calendar/v4/calendars/${calendarId}/events?page_size=${pageSize}`
    
    if (startTime) {
      endpoint += `&start_time=${startTime}`
    }
    if (endTime) {
      endpoint += `&end_time=${endTime}`
    }

    return this.apiRequest<EventListResponse>(endpoint)
  }

  /**
   * 创建日程
   */
  static async createEvent(
    event: CalendarEvent,
    calendarId?: string
  ): Promise<{ event_id: string }> {
    if (!calendarId) {
      calendarId = await this.getPrimaryCalendarId()
    }

    const response = await this.apiRequest<{ data: { event: { event_id: string } } }>(
      `/calendar/v4/calendars/${calendarId}/events`,
      {
        method: 'POST',
        body: JSON.stringify(event)
      }
    )

    return { event_id: response.data.event.event_id }
  }

  /**
   * 更新日程
   */
  static async updateEvent(
    eventId: string,
    event: Partial<CalendarEvent>,
    calendarId?: string
  ): Promise<void> {
    if (!calendarId) {
      calendarId = await this.getPrimaryCalendarId()
    }

    await this.apiRequest(
      `/calendar/v4/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(event)
      }
    )
  }

  /**
   * 删除日程
   */
  static async deleteEvent(eventId: string, calendarId?: string): Promise<void> {
    if (!calendarId) {
      calendarId = await this.getPrimaryCalendarId()
    }

    await this.apiRequest(
      `/calendar/v4/calendars/${calendarId}/events/${eventId}`,
      {
        method: 'DELETE'
      }
    )
  }

  /**
   * 获取今天的日程
   */
  static async getTodayEvents(calendarId?: string): Promise<CalendarEvent[]> {
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const startTime = Math.floor(startOfDay.getTime() / 1000).toString()
    const endTime = Math.floor(endOfDay.getTime() / 1000).toString()

    const response = await this.getEvents(calendarId, startTime, endTime)
    return response.data.items
  }

  /**
   * 获取本周的日程
   */
  static async getWeekEvents(calendarId?: string): Promise<CalendarEvent[]> {
    const today = new Date()
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay())
    const endOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 7)

    const startTime = Math.floor(startOfWeek.getTime() / 1000).toString()
    const endTime = Math.floor(endOfWeek.getTime() / 1000).toString()

    const response = await this.getEvents(calendarId, startTime, endTime)
    return response.data.items
  }

  /**
   * 快速创建日程（简化版）
   */
  static async quickCreateEvent(
    title: string,
    startTime: Date,
    endTime: Date,
    description?: string,
    calendarId?: string
  ): Promise<{ event_id: string }> {
    const event: CalendarEvent = {
      summary: title,
      description,
      start_time: {
        timestamp: Math.floor(startTime.getTime() / 1000).toString()
      },
      end_time: {
        timestamp: Math.floor(endTime.getTime() / 1000).toString()
      },
      visibility: 'default',
      free_busy_status: 'busy'
    }

    return this.createEvent(event, calendarId)
  }

  /**
   * 获取用户信息（用于调试）
   */
  static getLoginInfo() {
    return FeishuTokenManager.getLoginSummary()
  }
}
