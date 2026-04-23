import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function formatTime(date: string | Date): string {
  const d = new Date(date)
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`
}

/**
 * 生成唯一ID
 * 使用crypto.randomUUID()（更安全）或降级为时间戳+随机数组合
 * 格式：xxx-xxx-xxx-xxx-xxx (UUID v4) 或 xxx_timestamp_random (降级模式)
 */
export function generateId(): string {
  // 优先使用crypto.randomUUID()（支持现代浏览器和Node.js环境）
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }

  // 降级方案：使用更安全的组合方式
  // 格式：前缀_时间戳_随机数_计数器
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 11)

  // 使用性能计时器增加唯一性（如果可用）
  const perfNow = typeof performance !== 'undefined' ? performance.now().toString(36).replace('.', '') : ''

  return `${timestamp}_${randomPart}_${perfNow}`
}

/**
 * 生成短ID（用于需要较短ID的场景）
 * 格式：时间戳+随机字符串
 */
export function generateShortId(): string {
  const timestamp = Date.now().toString(36)
  const randomPart = Math.random().toString(36).substring(2, 7)
  return `${timestamp}${randomPart}`
} 