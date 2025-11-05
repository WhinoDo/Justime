'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar, Clock, Users, MapPin, RefreshCw, Settings, Search } from 'lucide-react'

interface CalendarEvent {
  event_id: string
  summary: string
  description?: string
  start_time: {
    timestamp: string
    timezone: string
  }
  end_time: {
    timestamp: string
    timezone: string
  }
  status: string
  creator?: {
    open_id: string
    user_id?: string
    union_id?: string
  }
  attendees?: Array<{
    open_id: string
    user_id?: string
    union_id?: string
    response_status: string
    display_name?: string
  }>
  location?: {
    name: string
    address?: string
    latitude?: number
    longitude?: number
  }
  is_all_day?: boolean
  visibility?: string
  is_meeting?: boolean
  meeting_url?: string
  organizer?: {
    open_id: string
    user_id?: string
    union_id?: string
  }
}

interface AdvancedCalendarEventsProps {
  calendarId: string
}

export function AdvancedCalendarEvents({ calendarId }: AdvancedCalendarEventsProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [pageToken, setPageToken] = useState<string>('')
  const [syncToken, setSyncToken] = useState<string>('')
  
  // 查询参数
  const [queryType, setQueryType] = useState<'time_range' | 'anchor_time' | 'sync' | 'page'>('time_range')
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [anchorTime, setAnchorTime] = useState<string>('')
  const [userIdType, setUserIdType] = useState<'open_id' | 'union_id' | 'user_id'>('open_id')

  // 获取当前时间戳
  const getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000).toString()
  }

  // 获取一周后的时间戳
  const getWeekLaterTimestamp = () => {
    const weekLater = new Date()
    weekLater.setDate(weekLater.getDate() + 7)
    return Math.floor(weekLater.getTime() / 1000).toString()
  }

  // 获取日程列表
  const fetchEvents = async (loadMore = false) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        calendar_id: calendarId,
        page_size: '50',
        user_id_type: userIdType
      })

      // 根据查询类型添加参数
      switch (queryType) {
        case 'time_range':
          if (startTime) params.append('start_time', startTime)
          if (endTime) params.append('end_time', endTime)
          break
        case 'anchor_time':
          if (anchorTime) params.append('anchor_time', anchorTime)
          if (loadMore && pageToken) params.append('page_token', pageToken)
          break
        case 'sync':
          if (syncToken) params.append('sync_token', syncToken)
          break
        case 'page':
          if (loadMore && pageToken) params.append('page_token', pageToken)
          break
      }

      const response = await fetch(`/api/feishu/calendar-events?${params.toString()}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '获取日程失败')
      }

      if (data.success) {
        if (loadMore) {
          setEvents(prev => [...prev, ...data.data.items])
        } else {
          setEvents(data.data.items)
        }
        
        setHasMore(data.data.pagination.has_more)
        setPageToken(data.data.pagination.page_token)
        
        // 保存sync_token用于增量同步
        if (data.data.pagination.sync_token) {
          setSyncToken(data.data.pagination.sync_token)
        }
      } else {
        throw new Error(data.error || '获取日程失败')
      }

    } catch (error) {
      console.error('获取日程失败:', error)
      setError(error instanceof Error ? error.message : '获取日程失败')
    } finally {
      setLoading(false)
    }
  }

  // 加载更多
  const loadMore = () => {
    if (hasMore && pageToken && !loading) {
      fetchEvents(true)
    }
  }

  // 刷新列表
  const refresh = () => {
    setPageToken('')
    setSyncToken('')
    fetchEvents()
  }

  // 增量同步
  const syncChanges = () => {
    if (syncToken) {
      setQueryType('sync')
      fetchEvents()
    }
  }

  // 格式化时间
  const formatTime = (timestamp: string, isAllDay?: boolean) => {
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
  }, [calendarId, queryType])

  return (
    <div className="space-y-6">
      {/* 查询设置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            高级查询设置
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={queryType} onValueChange={(value) => setQueryType(value as any)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="time_range">时间范围</TabsTrigger>
              <TabsTrigger value="anchor_time">锚点时间</TabsTrigger>
              <TabsTrigger value="sync">增量同步</TabsTrigger>
              <TabsTrigger value="page">分页查询</TabsTrigger>
            </TabsList>
            
            <TabsContent value="time_range" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-time">开始时间</Label>
                  <Input
                    id="start-time"
                    type="datetime-local"
                    value={startTime ? new Date(parseInt(startTime) * 1000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => {
                      const timestamp = e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000).toString() : ''
                      setStartTime(timestamp)
                    }}
                    placeholder="选择开始时间"
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">结束时间</Label>
                  <Input
                    id="end-time"
                    type="datetime-local"
                    value={endTime ? new Date(parseInt(endTime) * 1000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => {
                      const timestamp = e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000).toString() : ''
                      setEndTime(timestamp)
                    }}
                    placeholder="选择结束时间"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => {
                  setStartTime(getCurrentTimestamp())
                  setEndTime(getWeekLaterTimestamp())
                }} variant="outline" size="sm">
                  设置为一周
                </Button>
                <Button onClick={() => {
                  setStartTime('')
                  setEndTime('')
                }} variant="outline" size="sm">
                  清除时间范围
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="anchor_time" className="space-y-4">
              <div>
                <Label htmlFor="anchor-time">锚点时间</Label>
                <Input
                  id="anchor-time"
                  type="datetime-local"
                  value={anchorTime ? new Date(parseInt(anchorTime) * 1000).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const timestamp = e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000).toString() : ''
                    setAnchorTime(timestamp)
                  }}
                  placeholder="选择锚点时间"
                />
                <p className="text-sm text-gray-500 mt-1">
                  锚点时间用于设定拉取日程的时间锚点，避免拉取全部日程
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="sync" className="space-y-4">
              <div>
                <Label>增量同步</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={syncToken}
                    onChange={(e) => setSyncToken(e.target.value)}
                    placeholder="同步令牌"
                    readOnly
                  />
                  <Button onClick={syncChanges} disabled={!syncToken} size="sm">
                    同步变更
                  </Button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  使用sync_token增量获取日程变更数据
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="page" className="space-y-4">
              <div>
                <Label>分页查询</Label>
                <p className="text-sm text-gray-500">
                  使用page_token进行分页查询，适合大量数据的逐页加载
                </p>
              </div>
            </TabsContent>
          </Tabs>
          
          <div className="flex items-center gap-4 mt-4">
            <div>
              <Label htmlFor="user-id-type">用户ID类型</Label>
              <Select value={userIdType} onValueChange={(value) => setUserIdType(value as any)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open_id">Open ID</SelectItem>
                  <SelectItem value="union_id">Union ID</SelectItem>
                  <SelectItem value="user_id">User ID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button onClick={() => fetchEvents()} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                查询
              </Button>
              <Button onClick={refresh} variant="outline" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 日程列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            日程列表 ({events.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && events.length === 0 ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>正在加载日程...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-500 mb-4">❌ {error}</div>
              <Button onClick={refresh} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                重试
              </Button>
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
                        <span>组织者: {event.organizer.open_id}</span>
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
                                {attendee.display_name || attendee.open_id} ({getAttendeeStatusText(attendee.response_status)})
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
                    {event.visibility && (
                      <Badge variant="outline">
                        可见性: {event.visibility}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              
              {events.length === 0 && !loading && (
                <div className="text-center py-8 text-gray-500">
                  暂无日程数据
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
    </div>
  )
}
