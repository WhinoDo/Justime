'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { TimeUtils, dayjs } from '@/lib/utils/time'
import { TimeAwareTaskInput } from '@/components/chat/TimeAwareTaskInput'
import { Clock, Calendar, Zap, MessageSquare, RefreshCw } from 'lucide-react'

export default function TimeTestPage() {
  const [currentTime, setCurrentTime] = useState(TimeUtils.getCurrentTimeContext())
  const [testExpression, setTestExpression] = useState('')
  const [parsedTime, setParsedTime] = useState<string>('')
  const [chatMessage, setChatMessage] = useState('')
  const [chatResponse, setChatResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 更新当前时间
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(TimeUtils.getCurrentTimeContext())
    }

    updateTime()
    const interval = setInterval(updateTime, 1000) // 每秒更新一次用于演示

    return () => clearInterval(interval)
  }, [])

  const handleParseTime = () => {
    if (testExpression.trim()) {
      try {
        const parsed = TimeUtils.parseRelativeTime(testExpression)
        setParsedTime(parsed.format('YYYY年MM月DD日 HH:mm:ss'))
      } catch (error) {
        setParsedTime('解析失败')
      }
    }
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: chatMessage,
          taskId: 'time-test'
        })
      })

      const data = await response.json()
      if (data.success) {
        setChatResponse(data.data.response)
      } else {
        setChatResponse('发送失败: ' + data.error)
      }
    } catch (error) {
      setChatResponse('发送失败: ' + (error instanceof Error ? error.message : '未知错误'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleTaskCreate = (taskDescription: string) => {
    setChatMessage(taskDescription)
  }

  const timeExamples = [
    '明天上午',
    '后天下午2点',
    '2小时后',
    '30分钟后',
    '下周一',
    '下个月',
    '今天晚上8点'
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              时间感知功能测试
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertDescription>
                这个页面用于测试时间感知功能，包括当前时间获取、相对时间解析、智能时间建议等功能。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 当前时间信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                当前时间信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">当前时间:</span>
                  <div className="text-lg font-mono">{currentTime.formatted.datetime}</div>
                </div>
                <div>
                  <span className="font-medium">星期:</span>
                  <div className="text-lg">{currentTime.formatted.weekday}</div>
                </div>
                <div>
                  <span className="font-medium">时间段:</span>
                  <div className="text-lg">{currentTime.timeOfDay}</div>
                </div>
                <div>
                  <span className="font-medium">时区:</span>
                  <div className="text-lg">{currentTime.timezone}</div>
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">AI 上下文信息</h4>
                <pre className="text-xs text-blue-800 whitespace-pre-wrap">
                  {TimeUtils.getTimeContextForAI()}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* 时间解析测试 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                相对时间解析测试
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={testExpression}
                  onChange={(e) => setTestExpression(e.target.value)}
                  placeholder="输入时间表达式，如：明天上午"
                  className="flex-1"
                />
                <Button onClick={handleParseTime}>
                  解析
                </Button>
              </div>

              {parsedTime && (
                <div className="p-3 bg-green-50 rounded-lg">
                  <span className="font-medium text-green-900">解析结果:</span>
                  <div className="text-green-800">{parsedTime}</div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="font-medium text-gray-700">快速测试</h4>
                <div className="grid grid-cols-2 gap-2">
                  {timeExamples.map((example, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => setTestExpression(example)}
                    >
                      {example}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 智能时间助手 */}
        <TimeAwareTaskInput 
          onTaskCreate={handleTaskCreate}
          className="lg:col-span-2"
        />

        {/* 对话测试 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              时间感知对话测试
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="输入包含时间的任务描述，如：明天上午9点复习数学"
                className="flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
              />
              <Button 
                onClick={handleSendMessage}
                disabled={isLoading || !chatMessage.trim()}
              >
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : '发送'}
              </Button>
            </div>

            {chatResponse && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">AI 回复:</h4>
                <div className="text-gray-800 whitespace-pre-wrap">{chatResponse}</div>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">示例消息</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  '明天上午9点复习高数',
                  '今天下午2点小组讨论',
                  '2小时后提交作业',
                  '下周一准备期末考试',
                  '帮我安排这周的学习计划',
                  '我需要在期末考试前完成所有作业'
                ].map((example, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    size="sm"
                    onClick={() => setChatMessage(example)}
                    className="justify-start text-left h-auto p-2"
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 智能时间建议 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              智能时间建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {TimeUtils.generateSmartTimeSlots('study', 90).map((slot, index) => (
                <div key={index} className="p-3 border rounded-lg">
                  <h4 className="font-medium text-gray-900">{slot.label}</h4>
                  <div className="text-sm text-gray-600">
                    {TimeUtils.formatForDisplay(slot.startTime, 'MM月DD日 HH:mm')} - {TimeUtils.formatForDisplay(slot.endTime, 'HH:mm')}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{slot.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
