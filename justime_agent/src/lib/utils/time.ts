import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import relativeTime from 'dayjs/plugin/relativeTime'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import weekday from 'dayjs/plugin/weekday'
import isoWeek from 'dayjs/plugin/isoWeek'
import duration from 'dayjs/plugin/duration'

// 配置 dayjs 插件
dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)
dayjs.extend(customParseFormat)
dayjs.extend(weekday)
dayjs.extend(isoWeek)
dayjs.extend(duration)

// 设置中文语言
dayjs.locale('zh-cn')

// 设置默认时区为中国时区
const DEFAULT_TIMEZONE = 'Asia/Shanghai'

export class TimeUtils {
  /**
   * 获取当前时间信息（用于发送给AI模型）
   */
  static getCurrentTimeContext(): {
    currentTime: string
    currentDate: string
    currentDateTime: string
    timezone: string
    weekday: string
    timeOfDay: string
    timestamp: number
    iso: string
    formatted: {
      date: string
      time: string
      datetime: string
      weekday: string
      relative: string
    }
  } {
    const now = dayjs().tz(DEFAULT_TIMEZONE)
    
    // 判断时间段
    const hour = now.hour()
    let timeOfDay = '深夜'
    if (hour >= 5 && hour < 8) timeOfDay = '清晨'
    else if (hour >= 8 && hour < 12) timeOfDay = '上午'
    else if (hour >= 12 && hour < 14) timeOfDay = '中午'
    else if (hour >= 14 && hour < 18) timeOfDay = '下午'
    else if (hour >= 18 && hour < 22) timeOfDay = '晚上'
    else if (hour >= 22 || hour < 5) timeOfDay = '深夜'

    return {
      currentTime: now.format('HH:mm:ss'),
      currentDate: now.format('YYYY-MM-DD'),
      currentDateTime: now.format('YYYY-MM-DD HH:mm:ss'),
      timezone: DEFAULT_TIMEZONE,
      weekday: now.format('dddd'),
      timeOfDay,
      timestamp: now.valueOf(),
      iso: now.toISOString(),
      formatted: {
        date: now.format('YYYY年MM月DD日'),
        time: now.format('HH:mm'),
        datetime: now.format('YYYY年MM月DD日 HH:mm'),
        weekday: now.format('dddd'),
        relative: now.fromNow()
      }
    }
  }

  /**
   * 生成用于AI对话的时间上下文字符串
   */
  static getTimeContextForAI(): string {
    const timeInfo = this.getCurrentTimeContext()
    
    return `当前时间信息：
- 日期时间: ${timeInfo.formatted.datetime}
- 星期: ${timeInfo.formatted.weekday}
- 时间段: ${timeInfo.timeOfDay}
- 时区: ${timeInfo.timezone}
- ISO格式: ${timeInfo.iso}`
  }

  /**
   * 解析相对时间表达式
   */
  static parseRelativeTime(expression: string, baseTime?: dayjs.Dayjs): dayjs.Dayjs {
    const base = baseTime || dayjs().tz(DEFAULT_TIMEZONE)
    
    // 处理常见的相对时间表达式
    const patterns = [
      { pattern: /今天|今日/, handler: () => base.startOf('day') },
      { pattern: /明天|明日/, handler: () => base.add(1, 'day').startOf('day') },
      { pattern: /后天/, handler: () => base.add(2, 'day').startOf('day') },
      { pattern: /昨天|昨日/, handler: () => base.subtract(1, 'day').startOf('day') },
      { pattern: /前天/, handler: () => base.subtract(2, 'day').startOf('day') },
      { pattern: /下周/, handler: () => base.add(1, 'week').startOf('week') },
      { pattern: /上周/, handler: () => base.subtract(1, 'week').startOf('week') },
      { pattern: /下个月/, handler: () => base.add(1, 'month').startOf('month') },
      { pattern: /上个月/, handler: () => base.subtract(1, 'month').startOf('month') },
      { pattern: /(\d+)小时后/, handler: (match: RegExpMatchArray) => base.add(parseInt(match[1]), 'hour') },
      { pattern: /(\d+)分钟后/, handler: (match: RegExpMatchArray) => base.add(parseInt(match[1]), 'minute') },
      { pattern: /(\d+)天后/, handler: (match: RegExpMatchArray) => base.add(parseInt(match[1]), 'day') },
      { pattern: /(\d+)周后/, handler: (match: RegExpMatchArray) => base.add(parseInt(match[1]), 'week') },
    ]

    for (const { pattern, handler } of patterns) {
      const match = expression.match(pattern)
      if (match) {
        return handler(match)
      }
    }

    // 如果没有匹配到模式，尝试直接解析
    try {
      return dayjs(expression).tz(DEFAULT_TIMEZONE)
    } catch {
      return base
    }
  }

  /**
   * 生成智能的默认时间建议
   */
  static generateSmartTimeSlots(taskType?: string, duration?: number): Array<{
    label: string
    startTime: string
    endTime: string
    description: string
  }> {
    const now = dayjs().tz(DEFAULT_TIMEZONE)
    const slots = []

    // 根据任务类型和当前时间生成建议
    const hour = now.hour()
    const defaultDuration = duration || 60 // 默认1小时

    // 今天的时间段建议
    if (hour < 9) {
      slots.push({
        label: '今天上午',
        startTime: now.hour(9).minute(0).second(0).toISOString(),
        endTime: now.hour(9).minute(0).second(0).add(defaultDuration, 'minute').toISOString(),
        description: '上午9点开始，适合重要任务'
      })
    }

    if (hour < 14) {
      slots.push({
        label: '今天下午',
        startTime: now.hour(14).minute(0).second(0).toISOString(),
        endTime: now.hour(14).minute(0).second(0).add(defaultDuration, 'minute').toISOString(),
        description: '下午2点开始，精力充沛'
      })
    }

    if (hour < 19) {
      slots.push({
        label: '今天晚上',
        startTime: now.hour(19).minute(0).second(0).toISOString(),
        endTime: now.hour(19).minute(0).second(0).add(defaultDuration, 'minute').toISOString(),
        description: '晚上7点开始，适合学习'
      })
    }

    // 明天的时间段建议
    const tomorrow = now.add(1, 'day')
    slots.push(
      {
        label: '明天上午',
        startTime: tomorrow.hour(9).minute(0).second(0).toISOString(),
        endTime: tomorrow.hour(9).minute(0).second(0).add(defaultDuration, 'minute').toISOString(),
        description: '明天上午9点，新的一天开始'
      },
      {
        label: '明天下午',
        startTime: tomorrow.hour(14).minute(0).second(0).toISOString(),
        endTime: tomorrow.hour(14).minute(0).second(0).add(defaultDuration, 'minute').toISOString(),
        description: '明天下午2点，效率时段'
      }
    )

    return slots.slice(0, 4) // 返回最多4个建议
  }

  /**
   * 格式化时间用于显示
   */
  static formatForDisplay(time: string | Date | dayjs.Dayjs, format?: string): string {
    const dt = dayjs(time).tz(DEFAULT_TIMEZONE)
    return dt.format(format || 'YYYY年MM月DD日 HH:mm')
  }

  /**
   * 计算时间差
   */
  static getTimeDifference(start: string | Date | dayjs.Dayjs, end: string | Date | dayjs.Dayjs): {
    duration: string
    minutes: number
    hours: number
    humanReadable: string
  } {
    const startTime = dayjs(start)
    const endTime = dayjs(end)
    const diff = endTime.diff(startTime)
    const duration = dayjs.duration(diff)

    return {
      duration: duration.format('HH:mm'),
      minutes: duration.asMinutes(),
      hours: duration.asHours(),
      humanReadable: duration.humanize()
    }
  }

  /**
   * 检查时间是否在工作时间内
   */
  static isWorkingHours(time?: string | Date | dayjs.Dayjs): boolean {
    const dt = time ? dayjs(time).tz(DEFAULT_TIMEZONE) : dayjs().tz(DEFAULT_TIMEZONE)
    const hour = dt.hour()
    const day = dt.day()
    
    // 周一到周五，9点到18点
    return day >= 1 && day <= 5 && hour >= 9 && hour < 18
  }

  /**
   * 获取下一个工作日
   */
  static getNextWorkingDay(from?: string | Date | dayjs.Dayjs): dayjs.Dayjs {
    let date = from ? dayjs(from).tz(DEFAULT_TIMEZONE) : dayjs().tz(DEFAULT_TIMEZONE)
    
    do {
      date = date.add(1, 'day')
    } while (date.day() === 0 || date.day() === 6) // 跳过周末
    
    return date
  }

  /**
   * 验证时间字符串格式
   */
  static isValidTime(timeString: string): boolean {
    return dayjs(timeString).isValid()
  }

  /**
   * 转换为ISO字符串
   */
  static toISO(time: string | Date | dayjs.Dayjs): string {
    return dayjs(time).tz(DEFAULT_TIMEZONE).toISOString()
  }
}

// 导出 dayjs 实例以供直接使用
export { dayjs }
export default TimeUtils
