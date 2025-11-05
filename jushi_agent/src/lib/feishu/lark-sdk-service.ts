/**
 * 飞书 Node.js SDK 服务类
 * 使用官方 @larksuiteoapi/node-sdk 进行日历等操作
 */

const lark = require('@larksuiteoapi/node-sdk')
import { FeishuTokenManager } from './token-manager'

export interface LarkCalendar {
  calendar_id: string
  summary: string
  description?: string
  permissions: string
  color: number
  type: string
  summary_alias?: string
}

export interface LarkEvent {
  event_id: string
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
  free_busy_status?: 'busy' | 'free'
}

export class LarkSDKService {
  private client: lark.Client
  private userAccessToken: string | null = null

  constructor() {
    // 从环境变量获取应用配置
    const appId = process.env.NEXT_PUBLIC_FEISHU_CLIENT_ID || process.env.FEISHU_CLIENT_ID
    const appSecret = process.env.FEISHU_CLIENT_SECRET

    if (!appId || !appSecret) {
      throw new Error('缺少飞书应用配置：FEISHU_CLIENT_ID 或 FEISHU_CLIENT_SECRET')
    }

    // 初始化飞书客户端
    this.client = new lark.Client({
      appId,
      appSecret,
      // 禁用自动token缓存，我们手动管理用户token
      disableTokenCache: true
    })

    // 获取用户访问令牌
    this.userAccessToken = FeishuTokenManager.getValidAccessToken()
    
    console.log('🔧 飞书SDK服务初始化完成:', {
      appId: appId.slice(0, 8) + '...',
      hasUserToken: !!this.userAccessToken
    })
  }

  /**
   * 检查用户是否已登录并有有效token
   */
  private checkUserAuth(): void {
    if (!this.userAccessToken) {
      throw new Error('用户未登录或访问令牌已过期，请重新登录')
    }
  }

  /**
   * 获取日历列表（使用官方 SDK 方式）
   */
  async getCalendarList(pageSize: number = 50, pageToken?: string): Promise<{
    calendars: LarkCalendar[]
    hasMore: boolean
    pageToken?: string
  }> {
    this.checkUserAuth()

    try {
      console.log('📅 正在获取日历列表...', { pageSize, pageToken })

      // 对于用户日历，需要使用用户访问令牌，但传递方式不同
      const response = await this.client.calendar.v4.calendar.list({
        params: {
          page_size: pageSize.toString(),
          ...(pageToken && { page_token: pageToken })
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.userAccessToken}`
        }
      })

      console.log('✅ 日历列表获取成功:', response.data)
      console.log('📊 响应详情:', {
        code: response.code,
        msg: response.msg,
        dataKeys: Object.keys(response.data || {}),
        calendarCount: response.data?.calendar_list?.length || response.data?.items?.length || 0
      })

      // 详细打印每个日历信息
      const calendars = response.data?.calendar_list || response.data?.items || []
      console.log('📋 SDK 日历详细信息:')
      calendars.forEach((calendar: any, index: number) => {
        console.log(`  ${index + 1}. 📅 ${calendar.summary} (${calendar.type})`)
        console.log(`     🆔 ID: ${calendar.calendar_id}`)
        console.log(`     🔐 权限: ${calendar.permissions}, 角色: ${calendar.role}`)
        console.log(`     🎨 颜色: ${calendar.color}`)
        if (calendar.description) {
          console.log(`     📝 描述: ${calendar.description}`)
        }
        if (calendar.summary_alias) {
          console.log(`     🏷️  别名: ${calendar.summary_alias}`)
        }
      })

      return {
        calendars: response.data?.calendar_list || response.data?.items || [],
        hasMore: response.data?.has_more || false,
        pageToken: response.data?.page_token
      }
    } catch (error: any) {
      console.error('❌ 获取日历列表失败:', error)

      // 详细的错误信息记录
      if (error.response) {
        console.error('📋 错误响应详情:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        })
      }

      const errorMessage = error.response?.data?.msg || error.message || '未知错误'
      const errorCode = error.response?.data?.code || error.response?.status || 'UNKNOWN'

      throw new Error(`获取日历列表失败 (${errorCode}): ${errorMessage}`)
    }
  }

  /**
   * 获取指定日历的事件列表（使用官方 SDK 方式）
   */
  async getCalendarEvents(
    calendarId: string,
    options: {
      pageSize?: number
      pageToken?: string
      startTime?: string
      endTime?: string
    } = {}
  ): Promise<{
    events: LarkEvent[]
    hasMore: boolean
    pageToken?: string
  }> {
    this.checkUserAuth()

    try {
      console.log(`📋 正在获取日历 ${calendarId.substring(0, 30)}... 的事件列表`, {
        pageSize: options.pageSize || 50,
        pageToken: options.pageToken,
        startTime: options.startTime,
        endTime: options.endTime,
        calendarIdPreview: `${calendarId.substring(0, 30)}...`
      })

      const params: any = {
        page_size: (options.pageSize || 50).toString(),
        user_id_type: 'open_id'  // 使用 open_id 类型
      }

      if (options.pageToken) params.page_token = options.pageToken

      // 处理时间参数 - 飞书 API 需要特定的时间格式
      if (options.startTime) {
        try {
          const startDate = new Date(options.startTime)

          // 验证日期是否有效
          if (isNaN(startDate.getTime())) {
            throw new Error(`无效的开始时间: ${options.startTime}`)
          }

          const startTimestamp = Math.floor(startDate.getTime() / 1000)
          params.start_time = startTimestamp.toString()

          console.log('🕐 开始时间转换:', {
            original: options.startTime,
            date: startDate.toISOString(),
            timestamp: startTimestamp,
            final: params.start_time,
            isValid: !isNaN(startDate.getTime())
          })
        } catch (error) {
          console.error('❌ 开始时间转换失败:', error)
          throw new Error(`开始时间格式错误: ${options.startTime}`)
        }
      }

      if (options.endTime) {
        try {
          const endDate = new Date(options.endTime)

          // 验证日期是否有效
          if (isNaN(endDate.getTime())) {
            throw new Error(`无效的结束时间: ${options.endTime}`)
          }

          const endTimestamp = Math.floor(endDate.getTime() / 1000)
          params.end_time = endTimestamp.toString()

          console.log('🕐 结束时间转换:', {
            original: options.endTime,
            date: endDate.toISOString(),
            timestamp: endTimestamp,
            final: params.end_time,
            isValid: !isNaN(endDate.getTime())
          })
        } catch (error) {
          console.error('❌ 结束时间转换失败:', error)
          throw new Error(`结束时间格式错误: ${options.endTime}`)
        }
      }

      console.log('📋 调用飞书 API 参数:', {
        calendar_id: `${calendarId.substring(0, 30)}...`,
        params: params,
        userToken: `${this.userAccessToken?.substring(0, 10)}...`
      })

      console.log('📋 最终调用参数:', {
        calendar_id: `${calendarId.substring(0, 30)}...`,
        params: params,
        userToken: `${this.userAccessToken?.substring(0, 10)}...`
      })

      // 根据官方文档，对于用户日历操作需要使用用户访问令牌
      const response = await this.client.calendar.v4.calendarEvent.list({
        path: {
          calendar_id: calendarId
        },
        params
      }, lark.withUserAccessToken(this.userAccessToken))

      console.log('✅ 事件列表获取成功:', response.data)
      console.log('📊 事件列表响应详情:', {
        code: response.code,
        msg: response.msg,
        eventsCount: response.data?.items?.length || 0,
        hasMore: response.data?.has_more,
        pageToken: response.data?.page_token
      })

      return {
        events: response.data?.items || [],
        hasMore: response.data?.has_more || false,
        pageToken: response.data?.page_token
      }
    } catch (error: any) {
      console.error('❌ 获取事件列表失败:', error)

      // 详细的错误信息
      if (error.response) {
        console.error('📋 飞书 API 错误响应:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          code: error.response.data?.code,
          msg: error.response.data?.msg
        })
      }

      if (error.request) {
        console.error('📋 请求详情:', {
          url: error.request.url,
          method: error.request.method
        })
      }

      throw new Error(`获取事件列表失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 创建日历事件（使用官方 SDK 方式）
   */
  async createCalendarEvent(
    calendarId: string,
    event: Partial<LarkEvent>
  ): Promise<{ eventId: string }> {
    this.checkUserAuth()

    try {
      console.log(`📝 正在创建日历事件...`, { calendarId, event })

      console.log('🔧 创建标准事件参数:', {
        calendarId: `${calendarId.substring(0, 30)}...`,
        summary: event.summary,
        startTimestamp: event.start_time?.timestamp,
        endTimestamp: event.end_time?.timestamp,
        userToken: `${this.userAccessToken?.substring(0, 10)}...`
      })

      // 创建日历事件需要使用用户访问令牌
      const response = await this.client.calendar.v4.calendarEvent.create({
        path: {
          calendar_id: calendarId
        },
        params: {
          user_id_type: 'open_id'  // 使用 open_id 类型
        },
        data: {
          summary: event.summary || '',
          description: event.description || '',
          need_notification: false,  // 默认不发送通知
          start_time: {
            timestamp: event.start_time?.timestamp || '',
            timezone: 'Asia/Shanghai'  // 设置时区
          },
          end_time: {
            timestamp: event.end_time?.timestamp || '',
            timezone: 'Asia/Shanghai'  // 设置时区
          },
          visibility: event.visibility || 'default',
          free_busy_status: event.free_busy_status || 'busy',
          // 可以根据需要添加更多字段
          ...(event.location && { location: event.location }),
          ...(event.attendees && { attendees: event.attendees })
        }
      },
      lark.withUserAccessToken(this.userAccessToken!)
      )

      console.log('✅ 事件创建成功:', response.data)

      return {
        eventId: response.data?.event?.event_id || ''
      }
    } catch (error) {
      console.error('❌ 创建事件失败:', error)
      throw new Error(`创建事件失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 使用飞书官方示例代码获取事件列表（用于调试）
   */
  async getCalendarEventsOfficial(calendarId: string, options: {
    pageSize?: number
    pageToken?: string
    startTime?: string
    endTime?: string
  } = {}): Promise<any> {
    try {
      console.log('🔧 使用飞书官方示例代码获取事件列表...')

      // 使用已有的客户端实例，不需要重新创建
      const client = this.client

      const params: any = {
        page_size: options.pageSize || 50,
        user_id_type: 'open_id'
      }

      if (options.pageToken) {
        params.page_token = options.pageToken
      }

      if (options.startTime) {
        const startTimestamp = Math.floor(new Date(options.startTime).getTime() / 1000)
        params.start_time = startTimestamp.toString()
        console.log('🕐 官方示例开始时间:', options.startTime, '->', startTimestamp)
      }

      if (options.endTime) {
        const endTimestamp = Math.floor(new Date(options.endTime).getTime() / 1000)
        params.end_time = endTimestamp.toString()
        console.log('🕐 官方示例结束时间:', options.endTime, '->', endTimestamp)
      }

      console.log('📋 官方示例调用参数:', {
        calendar_id: `${calendarId.substring(0, 30)}...`,
        params: params,
        userToken: `${this.userAccessToken?.substring(0, 10)}...`
      })

      const response = await client.calendar.v4.calendarEvent.list({
        path: {
          calendar_id: calendarId
        },
        params
      }, lark.withUserAccessToken(this.userAccessToken))

      console.log('📊 官方示例响应:', {
        code: response.code,
        msg: response.msg,
        data: response.data
      })

      if (response.code !== 0) {
        throw new Error(`飞书 API 错误: ${response.msg} (code: ${response.code})`)
      }

      return {
        events: response.data?.items || [],
        hasMore: response.data?.has_more || false,
        pageToken: response.data?.page_token
      }

    } catch (error) {
      console.error('❌ 官方示例请求失败:', error)
      throw error
    }
  }

  /**
   * 使用原始 HTTP 请求获取事件列表（用于调试）
   */
  async getCalendarEventsRaw(calendarId: string, options: {
    pageSize?: number
    pageToken?: string
    startTime?: string
    endTime?: string
  } = {}): Promise<any> {
    try {
      console.log('🔧 使用原始 HTTP 请求获取事件列表...')

      const params = new URLSearchParams()
      params.append('page_size', (options.pageSize || 50).toString())

      if (options.pageToken) {
        params.append('page_token', options.pageToken)
      }

      if (options.startTime) {
        try {
          const startDate = new Date(options.startTime)
          if (isNaN(startDate.getTime())) {
            throw new Error(`无效的开始时间: ${options.startTime}`)
          }

          const startTimestamp = Math.floor(startDate.getTime() / 1000)
          params.append('start_time', startTimestamp.toString())
          console.log('🕐 原始请求开始时间:', {
            original: options.startTime,
            timestamp: startTimestamp,
            isValid: !isNaN(startDate.getTime())
          })
        } catch (error) {
          console.error('❌ 原始请求开始时间转换失败:', error)
          throw error
        }
      }

      if (options.endTime) {
        try {
          const endDate = new Date(options.endTime)
          if (isNaN(endDate.getTime())) {
            throw new Error(`无效的结束时间: ${options.endTime}`)
          }

          const endTimestamp = Math.floor(endDate.getTime() / 1000)
          params.append('end_time', endTimestamp.toString())
          console.log('🕐 原始请求结束时间:', {
            original: options.endTime,
            timestamp: endTimestamp,
            isValid: !isNaN(endDate.getTime())
          })
        } catch (error) {
          console.error('❌ 原始请求结束时间转换失败:', error)
          throw error
        }
      }

      const url = `https://open.feishu.cn/open-apis/calendar/v4/calendars/${calendarId}/events?${params.toString()}`

      console.log('📋 原始请求详情:', {
        url,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.userAccessToken?.substring(0, 10)}...`,
          'Content-Type': 'application/json'
        }
      })

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.userAccessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      console.log('📊 原始请求响应:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        data: data
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.msg || response.statusText}`)
      }

      return {
        events: data.data?.items || [],
        hasMore: data.data?.has_more || false,
        pageToken: data.data?.page_token
      }

    } catch (error) {
      console.error('❌ 原始 HTTP 请求失败:', error)
      throw error
    }
  }

  /**
   * 获取主日历ID
   */
  async getPrimaryCalendarId(): Promise<string> {
    const { calendars } = await this.getCalendarList()

    console.log('📅 可用日历列表:', calendars.map(cal => ({
      id: cal.calendar_id,
      summary: cal.summary,
      type: cal.type,
      permissions: cal.permissions
    })))

    // 查找主日历（通常是第一个或者类型为primary的）
    const primaryCalendar = calendars.find(
      cal => cal.type === 'primary' || cal.permissions.includes('owner')
    ) || calendars[0]

    if (!primaryCalendar) {
      console.warn('⚠️ 未找到可用的日历，可能需要：')
      console.warn('1. 在飞书客户端中创建日历')
      console.warn('2. 检查应用权限配置')
      console.warn('3. 确认账号有日历访问权限')
      throw new Error('未找到可用的日历。请在飞书客户端中创建日历，或检查应用权限配置。')
    }

    console.log('🎯 找到主日历:', primaryCalendar.summary, primaryCalendar.calendar_id)
    return primaryCalendar.calendar_id
  }

  /**
   * 获取今天的事件
   */
  async getTodayEvents(calendarId?: string): Promise<LarkEvent[]> {
    console.log('📅 开始获取今日事件...', { providedCalendarId: calendarId })

    if (!calendarId) {
      console.log('🔍 未提供日历ID，正在获取主日历...')
      calendarId = await this.getPrimaryCalendarId()
    }

    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    // 验证时间是否有效
    if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
      throw new Error('无效的今日时间范围')
    }

    // getCalendarEvents 期望 ISO 字符串格式，不是时间戳
    const startTimeISO = startOfDay.toISOString()
    const endTimeISO = endOfDay.toISOString()

    console.log('⏰ 今日时间范围:', {
      startOfDay: startOfDay.toLocaleString(),
      endOfDay: endOfDay.toLocaleString(),
      startTimeISO,
      endTimeISO,
      startTimestamp: Math.floor(startOfDay.getTime() / 1000),
      endTimestamp: Math.floor(endOfDay.getTime() / 1000),
      calendarId: calendarId?.substring(0, 30) + '...'
    })

    const { events } = await this.getCalendarEvents(calendarId, {
      startTime: startTimeISO,
      endTime: endTimeISO
    })

    console.log('📋 今日事件获取结果:', {
      eventCount: events.length,
      events: events.map(e => ({
        id: e.event_id,
        summary: e.summary,
        start: e.start_time?.timestamp
      }))
    })

    return events
  }

  /**
   * 快速创建事件（简化版本）
   */
  async quickCreateEvent(
    title: string,
    startTime: Date,
    endTime: Date,
    description?: string,
    calendarId?: string
  ): Promise<{ eventId: string }> {
    if (!calendarId) {
      calendarId = await this.getPrimaryCalendarId()
    }

    const event: Partial<LarkEvent> = {
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

    return this.createCalendarEvent(calendarId, event)
  }

  /**
   * 创建完整的日程事件（包含更多字段）
   */
  async createFullEvent(
    calendarId: string,
    eventData: {
      title: string
      description?: string
      startTime: Date
      endTime: Date
      location?: {
        name?: string
        address?: string
        latitude?: number
        longitude?: number
      }
      attendees?: Array<{
        type: 'user' | 'chat' | 'resource' | 'third_party'
        attendee_id: string
      }>
      reminders?: Array<{
        minutes: number
      }>
      needNotification?: boolean
      visibility?: 'default' | 'public' | 'private'
      freeBusyStatus?: 'busy' | 'free'
    }
  ): Promise<{ eventId: string }> {
    this.checkUserAuth()

    try {
      console.log(`📝 正在创建完整日历事件...`, eventData)

      console.log('🔧 创建事件参数详情:', {
        calendarId: `${calendarId.substring(0, 30)}...`,
        title: eventData.title,
        startTime: eventData.startTime.toISOString(),
        endTime: eventData.endTime.toISOString(),
        location: eventData.location,
        needNotification: eventData.needNotification,
        reminders: eventData.reminders,
        userToken: `${this.userAccessToken?.substring(0, 10)}...`
      })

      const response = await this.client.calendar.v4.calendarEvent.create({
        path: {
          calendar_id: calendarId
        },
        params: {
          user_id_type: 'open_id'
        },
        data: {
          summary: eventData.title,
          description: eventData.description || '',
          need_notification: eventData.needNotification || false,
          start_time: {
            timestamp: Math.floor(eventData.startTime.getTime() / 1000).toString(),
            timezone: 'Asia/Shanghai'
          },
          end_time: {
            timestamp: Math.floor(eventData.endTime.getTime() / 1000).toString(),
            timezone: 'Asia/Shanghai'
          },
          visibility: eventData.visibility || 'default',
          free_busy_status: eventData.freeBusyStatus || 'busy',
          ...(eventData.location && { location: eventData.location }),
          ...(eventData.attendees && { attendees: eventData.attendees }),
          ...(eventData.reminders && { reminders: eventData.reminders })
        }
      },
      lark.withUserAccessToken(this.userAccessToken!)
      )

      console.log('✅ 完整事件创建成功:', response.data)

      return {
        eventId: response.data?.event?.event_id || ''
      }
    } catch (error) {
      console.error('❌ 创建完整事件失败:', error)
      throw new Error(`创建完整事件失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 刷新用户访问令牌
   */
  refreshUserToken(): void {
    this.userAccessToken = FeishuTokenManager.getValidAccessToken()
    console.log('🔄 用户访问令牌已刷新:', !!this.userAccessToken)
  }

  /**
   * 手动设置用户访问令牌
   */
  setUserToken(token: string): void {
    this.userAccessToken = token
    console.log('🔧 手动设置用户访问令牌:', !!this.userAccessToken)
  }

  /**
   * 获取当前用户信息（用于调试）
   */
  getCurrentUserInfo() {
    return {
      hasUserToken: !!this.userAccessToken,
      tokenInfo: FeishuTokenManager.getLoginSummary()
    }
  }
}
