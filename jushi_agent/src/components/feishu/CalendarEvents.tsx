'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Users, MapPin, RefreshCw, ChevronLeft, ChevronRight, LogIn } from 'lucide-react'
import SimpleLoginModal from './SimpleLoginModal'

interface CalendarEvent {
  event_id: string
  summary: string
  description: string
  start_time: {
    timestamp: string
    timezone: string
  }
  end_time: {
    timestamp: string
    timezone: string
  }
  location?: {
    name: string
    address: string
  }
  attendees?: Array<{
    open_id: string
    user_id: string
    name: string
    status: string
  }>
  organizer?: {
    open_id: string
    user_id: string
    name: string
  }
  is_all_day: boolean
  visibility: string
  status: string
  is_meeting: boolean
  meeting_url?: string
}

interface CalendarEventsProps {
  calendarId: string
  startTime?: string
  endTime?: string
  anchorTime?: string
  pageToken?: string
  syncToken?: string
  userIdType?: 'open_id' | 'union_id' | 'user_id'
}

export function CalendarEvents({ 
  calendarId, 
  startTime, 
  endTime, 
  anchorTime, 
  pageToken, 
  syncToken, 
  userIdType = 'open_id' 
}: CalendarEventsProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [currentPageToken, setCurrentPageToken] = useState<string>('')
  const [showLogin, setShowLogin] = useState(false)
  const [isAuthError, setIsAuthError] = useState(false)

  // 获取日历事件
  const fetchEvents = async (pageToken?: string) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        calendar_id: calendarId,
        page_size: '50',
        user_id_type: userIdType
      })

      // 根据参数类型添加相应参数
      if (startTime && endTime) {
        // 时间范围查询
        params.append('start_time', startTime)
        params.append('end_time', endTime)
      } else if (anchorTime) {
        // 锚点时间查询
        params.append('anchor_time', anchorTime)
        if (pageToken) {
          params.append('page_token', pageToken)
        }
      } else if (syncToken) {
        // 增量同步查询
        params.append('sync_token', syncToken)
      } else if (pageToken) {
        // 分页查询
        params.append('page_token', pageToken)
      }

      // 尝试从Cookie中获取令牌并添加到请求头
      const cookies = document.cookie.split(';')
      const feishuToken = cookies.find(cookie => cookie.trim().startsWith('feishu_access_token='))
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (feishuToken) {
        const token = feishuToken.split('=')[1]
        headers['Authorization'] = `Bearer ${token}`
        console.log('🔍 从Cookie获取令牌并添加到Authorization头:', token.substring(0, 20) + '...')
      }
      
      const response = await fetch(`http://localhost:8080/api/feishu/calendar-events?${params.toString()}`, {
        credentials: 'include',  // 包含Cookie
        headers
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '获取日历事件失败')
      }

      if (data.success) {
        if (pageToken) {
          // 追加到现有列表
          setEvents(prev => [...prev, ...data.data.items])
        } else {
          // 替换列表
          setEvents(data.data.items)
        }
        
        setHasMore(data.data.pagination.has_more)
        setCurrentPageToken(data.data.pagination.page_token)
      } else {
        throw new Error(data.error || '获取日历事件失败')
      }

    } catch (error) {
      console.error('获取日历事件失败:', error)
      const errorMessage = error instanceof Error ? error.message : '获取日历事件失败'
      setError(errorMessage)
      
      // 检查是否是认证错误
      const isAuthError = errorMessage.includes('未找到有效的飞书访问令牌') || 
                         errorMessage.includes('请先完成飞书登录') ||
                         errorMessage.includes('401') ||
                         errorMessage.includes('unauthorized')
      
      setIsAuthError(isAuthError)
    } finally {
      setLoading(false)
    }
  }

  // 加载更多
  const loadMore = () => {
    if (hasMore && currentPageToken && !loading) {
      fetchEvents(currentPageToken)
    }
  }

  // 刷新列表
  const refresh = () => {
    setCurrentPageToken('')
    setError(null)
    setIsAuthError(false)
    setShowLogin(false)
    fetchEvents()
  }

  // 处理登录成功
  const handleLoginSuccess = () => {
    console.log('✅ 飞书登录成功，刷新日历事件')
    setShowLogin(false)
    setIsAuthError(false)
    setError(null)
    refresh()
  }

  // 处理登录错误
  const handleLoginError = (error: string) => {
    console.error('❌ 飞书登录失败:', error)
    setError(`登录失败: ${error}`)
  }

  // 显示登录界面
  const showLoginModal = () => {
    console.log('🔄 点击飞书登录按钮，显示登录模态框')
    setShowLogin(true)
  }

  // 格式化时间
  const formatTime = (timestamp: string, isAllDay: boolean) => {
    const date = new Date(parseInt(timestamp) * 1000)
    
    if (isAllDay) {
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
    
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // 获取状态显示文本
  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'confirmed': '已确认',
      'tentative': '待定',
      'cancelled': '已取消'
    }
    return statusMap[status] || status
  }

  // 获取可见性显示文本
  const getVisibilityText = (visibility: string) => {
    const visibilityMap: Record<string, string> = {
      'default': '默认',
      'public': '公开',
      'private': '私有'
    }
    return visibilityMap[visibility] || visibility
  }

  // 获取与会者状态显示文本
  const getAttendeeStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'accepted': '已接受',
      'declined': '已拒绝',
      'tentative': '待定',
      'needs_action': '待回复'
    }
    return statusMap[status] || status
  }

  useEffect(() => {
    if (calendarId) {
      fetchEvents()
    }
  }, [calendarId, startTime, endTime])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            日历事件
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">❌ {error}</div>
            
            {isAuthError ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  需要先登录飞书账号才能访问日历事件
                </div>
                <div className="flex gap-2 justify-center">
                  <button 
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('🔄 原生按钮点击事件触发')
                      showLoginModal()
                    }} 
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                    disabled={false}
                    type="button"
                    style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  >
                    <LogIn className="h-4 w-4" />
                    飞书登录
                  </button>
                  <Button onClick={refresh} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    重试
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={refresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            日历事件
          </CardTitle>
          <Button onClick={refresh} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && events.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>正在加载日历事件...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event) => (
              <div key={event.event_id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">{event.summary}</h3>
                    {event.description && (
                      <p className="text-gray-600 text-sm mb-2">{event.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {event.is_meeting && (
                      <Badge variant="secondary" className="bg-blue-100">
                        会议
                      </Badge>
                    )}
                    {event.is_all_day && (
                      <Badge variant="outline">全天</Badge>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>
                      {formatTime(event.start_time.timestamp, event.is_all_day)}
                      {!event.is_all_day && (
                        <>
                          {' - '}
                          {formatTime(event.end_time.timestamp, false)}
                        </>
                      )}
                    </span>
                  </div>
                  
                  {event.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      <span>{event.location.name}</span>
                      {event.location.address && (
                        <span className="text-gray-500">({event.location.address})</span>
                      )}
                    </div>
                  )}
                  
                  {event.organizer && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>组织者: {event.organizer.name}</span>
                    </div>
                  )}
                  
                  {event.attendees && event.attendees.length > 0 && (
                    <div className="flex items-start gap-2 text-sm">
                      <Users className="h-4 w-4 mt-0.5 text-gray-600" />
                      <div className="flex-1">
                        <div className="text-gray-600 mb-1">与会者:</div>
                        <div className="flex flex-wrap gap-1">
                          {event.attendees.map((attendee, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {attendee.name} ({getAttendeeStatusText(attendee.status)})
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {event.meeting_url && (
                    <div className="mt-2">
                      <Button size="sm" variant="outline" asChild>
                        <a href={event.meeting_url} target="_blank" rel="noopener noreferrer">
                          加入会议
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2 mt-3 text-xs">
                  <Badge variant="outline">
                    状态: {getStatusText(event.status)}
                  </Badge>
                  <Badge variant="outline">
                    可见性: {getVisibilityText(event.visibility)}
                  </Badge>
                </div>
              </div>
            ))}
            
            {events.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                暂无事件数据
              </div>
            )}
            
            {hasMore && (
              <div className="text-center pt-4">
                <Button onClick={loadMore} disabled={loading} variant="outline">
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      加载中...
                    </>
                  ) : (
                    '加载更多'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
    
    {/* 飞书登录模态框 */}
    <SimpleLoginModal
      isOpen={showLogin}
      onClose={() => {
        console.log('🔄 关闭登录模态框')
        setShowLogin(false)
      }}
      onLoginSuccess={handleLoginSuccess}
      onLoginError={handleLoginError}
    />
  </>
  )
}
