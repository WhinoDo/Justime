'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

interface DatePickerProps {
  selectedDate: Date
  onDateChange: (date: Date) => void
  onClose?: () => void
}

export function DatePicker({ selectedDate, onDateChange, onClose }: DatePickerProps) {
  const [tempYear, setTempYear] = useState(selectedDate.getFullYear())
  const [tempMonth, setTempMonth] = useState(selectedDate.getMonth())

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i)
  
  const months = [
    { value: 0, label: '一月' },
    { value: 1, label: '二月' },
    { value: 2, label: '三月' },
    { value: 3, label: '四月' },
    { value: 4, label: '五月' },
    { value: 5, label: '六月' },
    { value: 6, label: '七月' },
    { value: 7, label: '八月' },
    { value: 8, label: '九月' },
    { value: 9, label: '十月' },
    { value: 10, label: '十一月' },
    { value: 11, label: '十二月' }
  ]

  const handleConfirm = () => {
    const newDate = new Date(tempYear, tempMonth, 1)
    onDateChange(newDate)
    onClose?.()
  }

  const handleCancel = () => {
    setTempYear(selectedDate.getFullYear())
    setTempMonth(selectedDate.getMonth())
    onClose?.()
  }

  const goToPrevYear = () => {
    setTempYear(prev => prev - 1)
  }

  const goToNextYear = () => {
    setTempYear(prev => prev + 1)
  }

  const goToPrevMonth = () => {
    if (tempMonth === 0) {
      setTempMonth(11)
      setTempYear(prev => prev - 1)
    } else {
      setTempMonth(prev => prev - 1)
    }
  }

  const goToNextMonth = () => {
    if (tempMonth === 11) {
      setTempMonth(0)
      setTempYear(prev => prev + 1)
    } else {
      setTempMonth(prev => prev + 1)
    }
  }

  return (
    <Card className="w-80">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          选择年月
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 年份选择 */}
        <div>
          <label className="text-sm font-medium mb-2 block">年份</label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPrevYear}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Select
              value={tempYear.toString()}
              onValueChange={(value) => setTempYear(parseInt(value))}
            >
              <SelectTrigger className="flex-1">
                <span>{tempYear}年</span>
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={goToNextYear}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 月份选择 */}
        <div>
          <label className="text-sm font-medium mb-2 block">月份</label>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={goToPrevMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Select
              value={tempMonth.toString()}
              onValueChange={(value) => setTempMonth(parseInt(value))}
            >
              <SelectTrigger className="flex-1">
                <span>{months[tempMonth].label}</span>
              </SelectTrigger>
              <SelectContent>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={goToNextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 预览 */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">预览</div>
          <div className="text-lg font-medium">
            {tempYear}年 {months[tempMonth].label}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleCancel} className="flex-1">
            取消
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            确定
          </Button>
        </div>

        {/* 快捷选择 */}
        <div className="border-t pt-4">
          <div className="text-sm font-medium mb-2">快捷选择</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const now = new Date()
                setTempYear(now.getFullYear())
                setTempMonth(now.getMonth())
              }}
            >
              本月
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextMonth = new Date()
                nextMonth.setMonth(nextMonth.getMonth() + 1)
                setTempYear(nextMonth.getFullYear())
                setTempMonth(nextMonth.getMonth())
              }}
            >
              下月
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const prevMonth = new Date()
                prevMonth.setMonth(prevMonth.getMonth() - 1)
                setTempYear(prevMonth.getFullYear())
                setTempMonth(prevMonth.getMonth())
              }}
            >
              上月
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const nextYear = new Date()
                nextYear.setFullYear(nextYear.getFullYear() + 1)
                setTempYear(nextYear.getFullYear())
                setTempMonth(nextYear.getMonth())
              }}
            >
              明年
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
