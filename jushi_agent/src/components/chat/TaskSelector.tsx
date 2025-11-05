'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TaskItem } from '@/lib/ai/task-planner'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { Calendar, Clock, MapPin, Bell, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface TaskSelectorProps {
  tasks: TaskItem[]
  onTaskAdded?: (taskId: string, success: boolean) => void
}

interface TaskStatus {
  [taskId: string]: 'pending' | 'adding' | 'success' | 'error'
}

interface Calendar {
  calendar_id: string
  summary: string
  description?: string
  type: string
  role: string
}

export const TaskSelector: React.FC<TaskSelectorProps> = ({ tasks, onTaskAdded }) => {
  const [taskStatus, setTaskStatus] = useState<TaskStatus>({})
  const { requireLogin } = useFeishuLogin()
  const [calendars, setCalendars] = useState<Calendar[]>([])
  const [selectedCalendar, setSelectedCalendar] = useState<string>('')
  const [loadingCalendars, setLoadingCalendars] = useState(false)

  // 获取日历列表
  useEffect(() => {
    const loadCalendars = async () => {
      try {
        const userToken = await FeishuTokenManager.getValidAccessTokenWithRefresh()
        if (!userToken) return

        setLoadingCalendars(true)
        // 注意：日历列表API已移除，请使用统一的飞书登录接口
        throw new Error('日历列表API已移除，请使用统一的飞书登录接口')

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data?.calendars) {
            setCalendars(data.data.calendars)
            // 默认选择主日历
            const primaryCalendar = data.data.calendars.find((cal: Calendar) => cal.type === 'primary')
            if (primaryCalendar) {
              setSelectedCalendar(primaryCalendar.calendar_id)
            }
          }
        }
      } catch (error) {
        console.error('获取日历列表失败:', error)
      } finally {
        setLoadingCalendars(false)
      }
    }

    loadCalendars()
  }, [])

  const handleAddToCalendar = async (task: TaskItem) => {
    setTaskStatus(prev => ({ ...prev, [task.id]: 'adding' }))

    try {
      console.log('🚀 开始添加任务到飞书日历:', {
        taskId: task.id,
        title: task.title,
        startTime: task.startTime,
        endTime: task.endTime,
        priority: task.priority,
        location: task.location,
        reminders: task.reminders
      })

      // 检查登录状态
      if (!requireLogin('需要登录飞书账号才能添加日程')) {
        setTaskStatus(prev => ({ ...prev, [task.id]: 'pending' }))
        return
      }

      // 获取用户访问令牌（带自动刷新）
      console.log('🔑 获取用户访问令牌...')
      const userToken = await FeishuTokenManager.getValidAccessTokenWithRefresh()
      if (!userToken) {
        console.log('❌ 无法获取有效的用户访问令牌')
        throw new Error('用户访问令牌无效，请重新登录飞书账号')
      }

      console.log('✅ 用户访问令牌获取成功:', `${userToken.substring(0, 10)}...`)

      // 验证时间格式
      const startDate = new Date(task.startTime)
      const endDate = new Date(task.endTime)

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error('任务时间格式无效')
      }

      if (startDate >= endDate) {
        throw new Error('开始时间不能晚于或等于结束时间')
      }

      console.log('⏰ 时间验证通过:', {
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        duration: `${Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60))} 分钟`
      })

      // 构建请求体，参考日历页面的成功实现
      const requestBody = {
        type: 'full', // 使用完整事件创建
        calendar_id: selectedCalendar || undefined, // 指定日历ID
        title: task.title,
        description: task.description || `优先级: ${task.priority}${task.category ? `\n分类: ${task.category}` : ''}`,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        location: task.location ? (typeof task.location === 'string' ? { name: task.location } : task.location) : undefined,
        need_notification: task.reminders && task.reminders.length > 0,
        reminders: task.reminders?.map(minutes => ({ minutes })),
        visibility: 'default',
        free_busy_status: 'busy',
        user_token: userToken
      }

      console.log('📤 请求参数详情:', {
        type: requestBody.type,
        title: requestBody.title,
        description: requestBody.description,
        start_time: requestBody.start_time,
        end_time: requestBody.end_time,
        location: requestBody.location,
        need_notification: requestBody.need_notification,
        reminders: requestBody.reminders,
        userToken: `${userToken.substring(0, 10)}...`
      })

      console.log('🌐 发送请求到飞书日历 API...')
      // 注意：API已移除，请使用统一的飞书登录接口
      throw new Error('API已移除，请使用统一的飞书登录接口')

      console.log('📥 API 响应状态:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      })

      let result
      try {
        result = await response.json()
        console.log('📊 API 响应数据:', result)
      } catch (parseError) {
        console.error('❌ 解析响应 JSON 失败:', parseError)
        const responseText = await response.text()
        console.error('📄 原始响应内容:', responseText)
        throw new Error('服务器响应格式错误')
      }

      if (!response.ok || !result.success) {
        console.error('❌ API 请求失败详情:', {
          httpStatus: response.status,
          httpStatusText: response.statusText,
          apiSuccess: result.success,
          apiError: result.error,
          apiData: result.data
        })

        // 检查是否是令牌过期错误
        if (result.error && (
          result.error.includes('expired') ||
          result.error.includes('Authentication token expired') ||
          result.error.includes('99991677') ||
          result.error.includes('99991668')
        )) {
          console.log('🔄 检测到令牌过期，清除本地令牌...')
          FeishuTokenManager.clearTokens()
          throw new Error('登录已过期，请重新登录飞书账号')
        }

        // 提供更详细的错误信息
        const errorMessage = result.error || `HTTP ${response.status}: ${response.statusText}`
        throw new Error(`创建日程失败: ${errorMessage}`)
      }

      console.log('✅ 日程创建成功!', {
        eventId: result.data?.eventId,
        taskId: task.id,
        title: task.title
      })

      setTaskStatus(prev => ({ ...prev, [task.id]: 'success' }))
      onTaskAdded?.(task.id, true)

      // 3秒后重置状态
      setTimeout(() => {
        setTaskStatus(prev => ({ ...prev, [task.id]: 'pending' }))
      }, 3000)

    } catch (error: any) {
      console.error('❌ 添加日程失败:', {
        taskId: task.id,
        taskTitle: task.title,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      })

      // 设置错误状态
      setTaskStatus(prev => ({ ...prev, [task.id]: 'error' }))
      onTaskAdded?.(task.id, false)

      // 显示用户友好的错误信息
      const errorMessage = error instanceof Error ? error.message : '添加日程失败'

      // 如果是令牌过期，提示用户重新登录
      if (errorMessage.includes('过期') || errorMessage.includes('expired')) {
        FeishuLoginRedirect.showLoginPrompt('登录已过期，请重新登录飞书账号后再试')
      } else {
        // 提供更详细的错误提示
        const detailedMessage = `添加日程失败: ${errorMessage}\n\n任务信息:\n标题: ${task.title}\n时间: ${formatTime(task.startTime)} - ${formatTime(task.endTime)}`
        alert(detailedMessage)
      }

      // 5秒后重置状态，给用户更多时间看到错误信息
      setTimeout(() => {
        setTaskStatus(prev => ({ ...prev, [task.id]: 'pending' }))
      }, 5000)
    }
  }

  const handleSkipTask = (task: TaskItem) => {
    setTaskStatus(prev => ({ ...prev, [task.id]: 'pending' }))
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getPriorityText = (priority: string) => {
    switch (priority) {
      case 'high': return '高优先级'
      case 'medium': return '中优先级'
      case 'low': return '低优先级'
      default: return '普通'
    }
  }

  if (!tasks || tasks.length === 0) {
    return null
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="text-sm font-medium text-gray-700 mb-2">
        📅 检测到 {tasks.length} 个任务，是否添加到飞书日历？
      </div>

      {/* 日历选择器 */}
      {calendars.length > 0 && (
        <div className="mb-3 p-3 bg-blue-50 rounded-lg">
          <div className="text-sm font-medium text-blue-900 mb-2">选择目标日历</div>
          <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={loadingCalendars ? "加载中..." : "选择日历"} />
            </SelectTrigger>
            <SelectContent>
              {calendars.map((calendar) => (
                <SelectItem key={calendar.calendar_id} value={calendar.calendar_id}>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    <span>{calendar.summary}</span>
                    {calendar.type === 'primary' && (
                      <Badge variant="secondary" className="text-xs">主日历</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedCalendar && (
            <div className="text-xs text-blue-600 mt-1">
              已选择: {calendars.find(cal => cal.calendar_id === selectedCalendar)?.summary}
            </div>
          )}
        </div>
      )}
      
      {tasks.map((task) => {
        const status = taskStatus[task.id] || 'pending'
        
        return (
          <div key={task.id} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="font-medium text-gray-900">{task.title}</h4>
                  <span className={`px-2 py-1 rounded-full text-xs ${getPriorityColor(task.priority)}`}>
                    {getPriorityText(task.priority)}
                  </span>
                </div>
                
                {task.description && (
                  <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                )}
                
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>⏰ {formatTime(task.startTime)} - {formatTime(task.endTime)}</span>
                  {task.location && <span>📍 {task.location}</span>}
                  {task.category && <span>🏷️ {task.category}</span>}
                </div>
                
                {task.reminders && task.reminders.length > 0 && (
                  <div className="mt-1 text-xs text-gray-400">
                    🔔 提前 {task.reminders.join(', ')} 分钟提醒
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 ml-4">
                {status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleAddToCalendar(task)}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => handleSkipTask(task)}
                      className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
                    >
                      No
                    </button>
                  </>
                )}
                
                {status === 'adding' && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    添加中...
                  </div>
                )}
                
                {status === 'success' && (
                  <div className="flex items-center gap-1 text-sm text-green-600">
                    <span>✅</span>
                    已添加
                  </div>
                )}
                
                {status === 'error' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-600">❌ 添加失败</span>
                    <button
                      onClick={() => handleAddToCalendar(task)}
                      className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
                    >
                      重试
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TaskSelector
