'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, Users, MapPin, RefreshCw, LogIn } from 'lucide-react'

interface CalendarInfo {
  calendar_id: string
  summary: string
  description: string
  permissions: string
  color: number
  type: string
  summary_alias: string
  is_deleted: boolean
  is_third_party: boolean
  role: string
}

interface CalendarListProps {
  onCalendarSelect?: (calendarId: string) => void
}

export function CalendarList({ onCalendarSelect }: CalendarListProps) {
  const [calendars, setCalendars] = useState<CalendarInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [pageToken, setPageToken] = useState<string>('')
  const [isAuthError, setIsAuthError] = useState(false)

  // 获取日历列表
  const fetchCalendars = async (pageToken?: string) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page_size: '50'
      })

      if (pageToken) {
        params.append('page_token', pageToken)
      }

      console.log('🔍 发送API请求，包含Cookie:', document.cookie)
      
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
      
      const response = await fetch(`http://localhost:8080/api/feishu/calendars?${params.toString()}`, {
        credentials: 'include',  // 包含Cookie
        headers
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '获取日历列表失败')
      }

      if (data.success) {
        if (pageToken) {
          // 追加到现有列表
          setCalendars(prev => [...prev, ...data.data.calendars])
        } else {
          // 替换列表
          setCalendars(data.data.calendars)
        }
        
        setHasMore(data.data.pagination.has_more)
        setPageToken(data.data.pagination.page_token)
      } else {
        throw new Error(data.error || '获取日历列表失败')
      }

    } catch (error) {
      console.error('获取日历列表失败:', error)
      const errorMessage = error instanceof Error ? error.message : '获取日历列表失败'
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
    if (hasMore && pageToken && !loading) {
      fetchCalendars(pageToken)
    }
  }

  // 刷新列表
  const refresh = () => {
    setPageToken('')
    setError(null)
    setIsAuthError(false)
    fetchCalendars()
  }


  // 直接跳转到飞书授权页面
  const handleFeishuLogin = () => {
    console.log('🔄 点击飞书登录按钮，直接跳转到飞书授权页面')
    
    const clientId = 'cli_a8e96281e53b500c'
    const redirectUri = `${window.location.origin}/feishu/bind-callback`
    const state = `auth_login_${Date.now()}`
    
    const authUrl = `https://passport.feishu.cn/suite/passport/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=auth:user.id:read offline_access&state=${state}`
    
    console.log('🔄 跳转到飞书授权页面:', authUrl)
    window.location.href = authUrl
  }


  // 获取权限显示文本
  const getPermissionText = (permissions: string) => {
    const permissionMap: Record<string, string> = {
      'private': '私有',
      'public': '公开',
      'shared': '共享'
    }
    return permissionMap[permissions] || permissions
  }

  // 获取角色显示文本
  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      'owner': '所有者',
      'editor': '编辑者',
      'reader': '查看者'
    }
    return roleMap[role] || role
  }

  // 获取类型显示文本
  const getTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      'primary': '主日历',
      'shared': '共享日历',
      'third_party': '第三方日历'
    }
    return typeMap[type] || type
  }

  // 获取颜色样式
  const getColorStyle = (color: number) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8C471', '#82E0AA', '#F1948A'
    ]
    return colors[Math.abs(color) % colors.length]
  }

  useEffect(() => {
    fetchCalendars()
  }, [])

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            日历列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="text-red-500 mb-4">❌ {error}</div>
            
            {isAuthError ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  需要先登录飞书账号才能访问日历
                </div>
                <div className="flex gap-2 justify-center">
                  <button 
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('🔄 原生按钮点击事件触发')
                      handleFeishuLogin()
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
            日历列表
          </CardTitle>
          <Button onClick={refresh} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && calendars.length === 0 ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>正在加载日历列表...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {calendars.map((calendar) => (
              <div
                key={calendar.calendar_id}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onCalendarSelect?.(calendar.calendar_id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: getColorStyle(calendar.color) }}
                      />
                      <h3 className="font-semibold text-lg">{calendar.summary}</h3>
                      {calendar.summary_alias && (
                        <Badge variant="secondary" className="text-xs">
                          {calendar.summary_alias}
                        </Badge>
                      )}
                    </div>
                    
                    {calendar.description && (
                      <p className="text-gray-600 text-sm mb-2">{calendar.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        权限: {getPermissionText(calendar.permissions)}
                      </Badge>
                      <Badge variant="outline">
                        类型: {getTypeText(calendar.type)}
                      </Badge>
                      <Badge variant="outline">
                        角色: {getRoleText(calendar.role)}
                      </Badge>
                      {calendar.is_third_party && (
                        <Badge variant="outline" className="bg-orange-100">
                          第三方
                        </Badge>
                      )}
                      {calendar.is_deleted && (
                        <Badge variant="destructive">
                          已删除
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {calendars.length === 0 && !loading && (
              <div className="text-center py-8 text-gray-500">
                暂无日历数据
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
    
  </>
  )
}
