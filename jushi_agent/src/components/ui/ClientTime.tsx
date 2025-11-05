'use client'

import { useState, useEffect } from 'react'

interface ClientTimeProps {
  format?: 'full' | 'date' | 'time' | 'datetime'
  className?: string
  fallback?: string
}

export function ClientTime({ 
  format = 'full', 
  className = '',
  fallback = '加载中...'
}: ClientTimeProps) {
  const [mounted, setMounted] = useState(false)
  const [currentTime, setCurrentTime] = useState<string>(fallback)

  useEffect(() => {
    setMounted(true)
    
    const updateTime = () => {
      const now = new Date()
      let formattedTime = ''
      
      switch (format) {
        case 'full':
          formattedTime = now.toLocaleString('zh-CN')
          break
        case 'date':
          formattedTime = now.toLocaleDateString('zh-CN')
          break
        case 'time':
          formattedTime = now.toLocaleTimeString('zh-CN')
          break
        case 'datetime':
          formattedTime = now.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          })
          break
        default:
          formattedTime = now.toLocaleString('zh-CN')
      }
      
      setCurrentTime(formattedTime)
    }

    // 立即更新一次
    updateTime()
    
    // 每秒更新一次（如果需要实时更新）
    const interval = setInterval(updateTime, 1000)
    
    return () => clearInterval(interval)
  }, [format])

  // 在服务器端渲染时显示 fallback
  if (!mounted) {
    return <span className={className}>{fallback}</span>
  }

  return <span className={className}>{currentTime}</span>
}

// 静态时间组件，避免水合不匹配
interface StaticTimeProps {
  timestamp?: number | string | Date
  format?: 'full' | 'date' | 'time' | 'datetime'
  className?: string
}

export function StaticTime({ 
  timestamp, 
  format = 'full', 
  className = '' 
}: StaticTimeProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <span className={className}>--</span>
  }

  const date = timestamp ? new Date(timestamp) : new Date()
  let formattedTime = ''
  
  switch (format) {
    case 'full':
      formattedTime = date.toLocaleString('zh-CN')
      break
    case 'date':
      formattedTime = date.toLocaleDateString('zh-CN')
      break
    case 'time':
      formattedTime = date.toLocaleTimeString('zh-CN')
      break
    case 'datetime':
      formattedTime = date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      break
    default:
      formattedTime = date.toLocaleString('zh-CN')
  }

  return <span className={className}>{formattedTime}</span>
}
