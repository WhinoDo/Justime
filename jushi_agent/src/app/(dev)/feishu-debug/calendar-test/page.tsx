'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FeishuTokenManager } from '@/lib/feishu/token-manager'
import { TaskItem } from '@/lib/ai/task-planner'
import { TaskSelector } from '@/components/chat/TaskSelector'
import { useFeishuLogin } from '@/hooks/useFeishuLogin'
import { Calendar, Clock, MapPin, Bell } from 'lucide-react'

export default function CalendarTestPage() {
  const { isLoggedIn, requireLogin } = useFeishuLogin()
  const [testTask, setTestTask] = useState<TaskItem>({
    id: 'test-task-1',
    title: '测试任务',
    description: '这是一个用于测试日历集成的任务',
    startTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1小时后
    endTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2小时后
    priority: 'medium',
    category: '测试',
    location: '会议室A',
    reminders: [15, 5]
  })
  const [isCreating, setIsCreating] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; eventId?: string } | null>(null)

  const handleCreateTestEvent = async () => {
    if (!requireLogin('需要登录飞书账号才能创建测试事件')) {
      return
    }

    setIsCreating(true)
    setResult(null)

    try {
      const userToken = await FeishuTokenManager.getValidAccessTokenWithRefresh()
      if (!userToken) {
        throw new Error('无法获取有效的用户访问令牌')
      }

      const requestBody = {
        type: 'full',
        calendar_id: undefined, // 使用默认主日历，可以修改为指定日历ID
        title: testTask.title,
        description: testTask.description,
        start_time: testTask.startTime,
        end_time: testTask.endTime,
        location: { name: testTask.location },
        need_notification: testTask.reminders && testTask.reminders.length > 0,
        reminders: testTask.reminders?.map(minutes => ({ minutes })),
        visibility: 'default',
        free_busy_status: 'busy',
        user_token: userToken
      }

      console.log('🧪 测试创建事件请求:', requestBody)

      // 注意：API已移除，请使用统一的飞书登录接口
        throw new Error('API已移除，请使用统一的飞书登录接口')
      })

      const data = await response.json()
      console.log('🧪 测试创建事件响应:', data)

      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建测试事件失败')
      }

      setResult({
        success: true,
        message: '测试事件创建成功！',
        eventId: data.data?.eventId
      })

    } catch (error) {
      console.error('❌ 创建测试事件失败:', error)
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '创建测试事件失败'
      })
    } finally {
      setIsCreating(false)
    }
  }

  const updateTestTask = (field: keyof TaskItem, value: any) => {
    setTestTask(prev => ({ ...prev, [field]: value }))
  }

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('zh-CN')
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              飞书日历集成测试
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!isLoggedIn && (
              <Alert>
                <AlertDescription>
                  请先登录飞书账号以测试日历集成功能
                </AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">任务标题</label>
                  <Input
                    value={testTask.title}
                    onChange={(e) => updateTestTask('title', e.target.value)}
                    placeholder="输入任务标题"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">任务描述</label>
                  <Textarea
                    value={testTask.description}
                    onChange={(e) => updateTestTask('description', e.target.value)}
                    placeholder="输入任务描述"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">开始时间</label>
                  <Input
                    type="datetime-local"
                    value={new Date(testTask.startTime).toISOString().slice(0, 16)}
                    onChange={(e) => updateTestTask('startTime', new Date(e.target.value).toISOString())}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">结束时间</label>
                  <Input
                    type="datetime-local"
                    value={new Date(testTask.endTime).toISOString().slice(0, 16)}
                    onChange={(e) => updateTestTask('endTime', new Date(e.target.value).toISOString())}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">地点</label>
                  <Input
                    value={testTask.location || ''}
                    onChange={(e) => updateTestTask('location', e.target.value)}
                    placeholder="输入地点"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">任务预览</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <span>{testTask.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span>{formatDateTime(testTask.startTime)} - {formatDateTime(testTask.endTime)}</span>
                    </div>
                    {testTask.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        <span>{testTask.location}</span>
                      </div>
                    )}
                    {testTask.reminders && testTask.reminders.length > 0 && (
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4 text-blue-600" />
                        <span>提醒: {testTask.reminders.join(', ')} 分钟前</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleCreateTestEvent}
                  disabled={!isLoggedIn || isCreating}
                  className="w-full"
                >
                  {isCreating ? '创建中...' : '创建测试事件'}
                </Button>

                {result && (
                  <Alert variant={result.success ? "default" : "destructive"}>
                    <AlertDescription>
                      {result.message}
                      {result.eventId && (
                        <div className="mt-2 text-xs">
                          事件ID: {result.eventId}
                        </div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>TaskSelector 组件测试</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskSelector
              tasks={[testTask]}
              onTaskAdded={(taskId, success) => {
                console.log(`TaskSelector: 任务 ${taskId} ${success ? '成功' : '失败'}`)
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
