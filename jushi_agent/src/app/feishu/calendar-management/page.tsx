'use client'

import React, { useState } from 'react'
import { CalendarList } from '@/components/feishu/CalendarList'
import { CalendarEvents } from '@/components/feishu/CalendarEvents'
import { AdvancedCalendarEvents } from '@/components/feishu/AdvancedCalendarEvents'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Calendar, Clock, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function CalendarManagementPage() {
  const [selectedCalendarId, setSelectedCalendarId] = useState<string>('')
  const [startTime, setStartTime] = useState<string>('')
  const [endTime, setEndTime] = useState<string>('')
  const [showEvents, setShowEvents] = useState(false)
  const [useAdvancedView, setUseAdvancedView] = useState(false)

  // 处理日历选择
  const handleCalendarSelect = (calendarId: string) => {
    setSelectedCalendarId(calendarId)
    setShowEvents(true)
  }

  // 处理时间范围设置
  const handleTimeRangeChange = () => {
    if (selectedCalendarId) {
      setShowEvents(true)
    }
  }

  // 重置选择
  const handleBack = () => {
    setSelectedCalendarId('')
    setShowEvents(false)
    setStartTime('')
    setEndTime('')
  }

  // 获取当前时间戳（秒）
  const getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000).toString()
  }

  // 获取一周后的时间戳
  const getWeekLaterTimestamp = () => {
    const weekLater = new Date()
    weekLater.setDate(weekLater.getDate() + 7)
    return Math.floor(weekLater.getTime() / 1000).toString()
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/feishu">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回飞书管理
            </Button>
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calendar className="h-8 w-8" />
            飞书日历管理
          </h1>
        </div>
        <p className="text-gray-600">
          管理您的飞书日历，查看日历列表和事件详情
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 日历列表 */}
        <div>
          <CalendarList onCalendarSelect={handleCalendarSelect} />
        </div>

        {/* 事件查询和显示 */}
        <div>
          {!showEvents ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  选择日历查看事件
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  请从左侧选择一个日历来查看其事件
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* 时间范围设置 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    时间范围设置
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-time">开始时间 (可选)</Label>
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
                      <Label htmlFor="end-time">结束时间 (可选)</Label>
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
                  
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleTimeRangeChange} size="sm">
                      应用时间范围
                    </Button>
                    <Button 
                      onClick={() => {
                        setStartTime(getCurrentTimestamp())
                        setEndTime(getWeekLaterTimestamp())
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      设置为一周
                    </Button>
                    <Button 
                      onClick={() => {
                        setStartTime('')
                        setEndTime('')
                        handleTimeRangeChange()
                      }} 
                      variant="outline" 
                      size="sm"
                    >
                      清除时间范围
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* 返回按钮 */}
              <div className="flex justify-between items-center">
                <Button onClick={handleBack} variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  返回日历列表
                </Button>
                <div className="text-sm text-gray-500">
                  当前日历ID: {selectedCalendarId}
                </div>
              </div>

              {/* 视图切换 */}
              <div className="flex justify-between items-center mb-4">
                <div className="flex gap-2">
                  <Button
                    onClick={() => setUseAdvancedView(false)}
                    variant={!useAdvancedView ? "default" : "outline"}
                    size="sm"
                  >
                    基础视图
                  </Button>
                  <Button
                    onClick={() => setUseAdvancedView(true)}
                    variant={useAdvancedView ? "default" : "outline"}
                    size="sm"
                  >
                    高级视图
                  </Button>
                </div>
                <div className="text-sm text-gray-500">
                  当前日历ID: {selectedCalendarId}
                </div>
              </div>

              {/* 事件列表 */}
              {useAdvancedView ? (
                <AdvancedCalendarEvents calendarId={selectedCalendarId} />
              ) : (
                <CalendarEvents 
                  calendarId={selectedCalendarId}
                  startTime={startTime || undefined}
                  endTime={endTime || undefined}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}