/**
 * API 请求日志工具
 * 用于在终端中打印详细的 API 请求和响应信息
 */

export class ApiLogger {
  private startTime: number
  private apiName: string

  constructor(apiName: string) {
    this.apiName = apiName
    this.startTime = Date.now()
    this.logStart()
  }

  private logStart() {
    console.log(`\n🚀 ===== ${this.apiName} API 请求开始 =====`)
    console.log(`⏰ 开始时间: ${new Date().toISOString()}`)
  }

  logRequest(params: any) {
    console.log('📥 请求参数:', {
      ...params,
      timestamp: new Date().toISOString()
    })
  }

  logError(message: string, error?: any) {
    console.log(`❌ 错误: ${message}`)
    if (error) {
      console.error('错误详情:', error)
    }
  }

  logInfo(message: string, data?: any) {
    console.log(`ℹ️  ${message}`)
    if (data) {
      console.log('详细信息:', data)
    }
  }

  logSuccess(message: string, data?: any) {
    const duration = Date.now() - this.startTime
    console.log(`✅ ${message}, 耗时: ${duration}ms`)
    if (data) {
      console.log('响应数据:', data)
    }
    console.log(`🏁 ===== ${this.apiName} API 请求结束 =====\n`)
  }

  logWarning(message: string, data?: any) {
    console.log(`⚠️  警告: ${message}`)
    if (data) {
      console.log('警告详情:', data)
    }
  }

  // 格式化敏感信息（如 token）
  static maskSensitiveData(data: string, visibleLength: number = 10): string {
    if (!data || data.length <= visibleLength) return data
    return `${data.substring(0, visibleLength)}...`
  }

  // 格式化对象中的敏感信息
  static maskSensitiveObject(obj: any, sensitiveKeys: string[] = ['token', 'password', 'secret']): any {
    const masked = { ...obj }
    
    for (const key in masked) {
      if (sensitiveKeys.some(sensitiveKey => key.toLowerCase().includes(sensitiveKey.toLowerCase()))) {
        if (typeof masked[key] === 'string') {
          masked[key] = this.maskSensitiveData(masked[key])
        }
      }
    }
    
    return masked
  }

  // 格式化数组数据
  static formatArrayData(array: any[], maxItems: number = 5): any {
    if (!Array.isArray(array)) return array
    
    const result = {
      count: array.length,
      items: array.slice(0, maxItems)
    }
    
    if (array.length > maxItems) {
      result.items.push(`... 还有 ${array.length - maxItems} 项`)
    }
    
    return result
  }

  // 格式化时间范围
  static formatTimeRange(startTime?: string, endTime?: string): string {
    if (!startTime && !endTime) return '全部时间'
    if (!endTime) return `从 ${startTime} 开始`
    if (!startTime) return `到 ${endTime} 结束`
    return `${startTime} ~ ${endTime}`
  }

  // 格式化文件大小
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // 格式化持续时间
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`
    return `${(ms / 60000).toFixed(2)}min`
  }
}

// 预定义的常用日志器
export const createCalendarLogger = () => new ApiLogger('日历列表')
export const createEventsLogger = () => new ApiLogger('日程事件')
export const createAuthLogger = () => new ApiLogger('身份验证')
export const createTokenLogger = () => new ApiLogger('令牌管理')

// 快捷日志函数
export const logApiRequest = (apiName: string, params: any) => {
  console.log(`\n🚀 ===== ${apiName} API 请求 =====`)
  console.log('📥 请求参数:', ApiLogger.maskSensitiveObject(params))
}

export const logApiResponse = (apiName: string, success: boolean, data: any, startTime: number) => {
  const duration = Date.now() - startTime
  const status = success ? '✅ 成功' : '❌ 失败'
  console.log(`${status} ${apiName} API 响应, 耗时: ${ApiLogger.formatDuration(duration)}`)
  
  if (data) {
    console.log('📤 响应数据:', data)
  }
  
  console.log(`🏁 ===== ${apiName} API 结束 =====\n`)
}

export const logApiError = (apiName: string, error: any, startTime: number) => {
  const duration = Date.now() - startTime
  console.log(`❌ ${apiName} API 失败, 耗时: ${ApiLogger.formatDuration(duration)}`)
  console.error('错误详情:', error)
  console.log(`🏁 ===== ${apiName} API 结束 =====\n`)
}
