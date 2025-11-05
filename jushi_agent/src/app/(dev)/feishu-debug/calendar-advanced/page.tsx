'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Calendar, Clock, MapPin, Users, Bell } from 'lucide-react'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { FeishuLoginRedirect } from '@/lib/feishu/login-redirect'

export default function AdvancedCalendarPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [eventData, setEventData] = useState({
    title: '',
    description: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: {
      name: '',
      address: ''
    },
    needNotification: false,
    visibility: 'default',
    freeBusyStatus: 'busy',
    reminders: [{ minutes: 15 }]
  })

  const isLoggedIn = FeishuTokenManager.isLoggedIn()

  const createAdvancedEvent = async () => {
    if (!isLoggedIn) {
      setResult({ error: '请先登录飞书账号' })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const userToken = FeishuTokenManager.getValidAccessToken()
      if (!userToken) {
        throw new Error('用户访问令牌无效，请重新登录')
      }

      const startDateTime = new Date(`${eventData.startDate}T${eventData.startTime}`)
      const endDateTime = eventData.endDate && eventData.endTime
        ? new Date(`${eventData.endDate}T${eventData.endTime}`)
        : new Date(startDateTime.getTime() + 60 * 60 * 1000)

      const requestBody = {
        type: 'full',
        title: eventData.title,
        description: eventData.description,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        user_token: userToken,
        location: eventData.location.name || eventData.location.address ? eventData.location : undefined,
        need_notification: eventData.needNotification,
        visibility: eventData.visibility,
        free_busy_status: eventData.freeBusyStatus,
        reminders: eventData.reminders
      }

      console.log('📝 创建高级日程请求:', requestBody)

      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口')
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error || '创建日程失败')
      }

      setResult({
        success: true,
        eventId: result.data.eventId,
        message: '高级日程创建成功！'
      })

      // 清空表单
      setEventData({
        title: '',
        description: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        location: { name: '', address: '' },
        needNotification: false,
        visibility: 'default',
        freeBusyStatus: 'busy',
        reminders: [{ minutes: 15 }]
      })

    } catch (error) {
      console.error('❌ 创建高级日程失败:', error)
      setResult({
        success: false,
        error: error instanceof Error ? error.message : '创建日程失败'
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-center">需要登录</CardTitle>
            <CardDescription className="text-center">
              请先登录飞书账号以使用高级日程创建功能
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => FeishuLoginRedirect.redirectToLogin(true)}>
              前往登录
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">高级日程创建</h1>
        <p className="text-gray-600 mt-2">使用飞书官方 SDK 创建包含更多字段的日程</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              日程信息
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                value={eventData.title}
                onChange={(e) => setEventData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="输入日程标题"
              />
            </div>

            <div>
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={eventData.description}
                onChange={(e) => setEventData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="输入日程描述"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">开始日期 *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={eventData.startDate}
                  onChange={(e) => setEventData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="startTime">开始时间 *</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={eventData.startTime}
                  onChange={(e) => setEventData(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="endDate">结束日期</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={eventData.endDate}
                  onChange={(e) => setEventData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="endTime">结束时间</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={eventData.endTime}
                  onChange={(e) => setEventData(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              高级选项
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="locationName">地点名称</Label>
              <Input
                id="locationName"
                value={eventData.location.name}
                onChange={(e) => setEventData(prev => ({ 
                  ...prev, 
                  location: { ...prev.location, name: e.target.value }
                }))}
                placeholder="会议室、地点名称"
              />
            </div>

            <div>
              <Label htmlFor="locationAddress">地点地址</Label>
              <Input
                id="locationAddress"
                value={eventData.location.address}
                onChange={(e) => setEventData(prev => ({ 
                  ...prev, 
                  location: { ...prev.location, address: e.target.value }
                }))}
                placeholder="详细地址"
              />
            </div>

            <div>
              <Label>可见性</Label>
              <Select 
                value={eventData.visibility} 
                onValueChange={(value) => setEventData(prev => ({ ...prev, visibility: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">默认</SelectItem>
                  <SelectItem value="public">公开</SelectItem>
                  <SelectItem value="private">私密</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>忙闲状态</Label>
              <Select 
                value={eventData.freeBusyStatus} 
                onValueChange={(value) => setEventData(prev => ({ ...prev, freeBusyStatus: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="busy">忙碌</SelectItem>
                  <SelectItem value="free">空闲</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notification"
                checked={eventData.needNotification}
                onCheckedChange={(checked) => setEventData(prev => ({ 
                  ...prev, 
                  needNotification: checked as boolean 
                }))}
              />
              <Label htmlFor="notification">发送通知</Label>
            </div>

            <Button
              onClick={createAdvancedEvent}
              disabled={loading || !eventData.title || !eventData.startDate || !eventData.startTime}
              className="w-full"
            >
              {loading ? '创建中...' : '创建高级日程'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>创建结果</CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <div className="space-y-2">
                <Badge variant="default">创建成功</Badge>
                <p className="text-green-600">{result.message}</p>
                <p className="text-sm text-gray-600">事件ID: {result.eventId}</p>
              </div>
            ) : (
              <Alert>
                <AlertDescription className="text-red-600">
                  {result.error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
