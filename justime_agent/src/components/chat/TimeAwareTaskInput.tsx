import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { TimeUtils } from '@/lib/utils/time'
import { Clock, Calendar, Zap, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TimeAwareTaskInputProps {
  onTaskCreate?: (taskDescription: string) => void
  className?: string
}

export function TimeAwareTaskInput({ onTaskCreate, className }: TimeAwareTaskInputProps) {
  const [currentTime, setCurrentTime] = useState(TimeUtils.getCurrentTimeContext())
  const [taskInput, setTaskInput] = useState('')
  const [suggestedTimes, setSuggestedTimes] = useState<Array<{
    label: string
    startTime: string
    endTime: string
    description: string
  }>>([])

  // 更新当前时间
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(TimeUtils.getCurrentTimeContext())
    }

    updateTime()
    const interval = setInterval(updateTime, 60000) // 每分钟更新一次

    return () => clearInterval(interval)
  }, [])

  // 生成时间建议
  useEffect(() => {
    const suggestions = TimeUtils.generateSmartTimeSlots('general', 60)
    setSuggestedTimes(suggestions)
  }, [currentTime])

  const handleQuickTimeInsert = (timeSlot: { label: string; startTime: string; endTime: string }) => {
    const timeText = `${timeSlot.label}(${TimeUtils.formatForDisplay(timeSlot.startTime, 'MM月DD日 HH:mm')} - ${TimeUtils.formatForDisplay(timeSlot.endTime, 'HH:mm')})`
    
    if (taskInput.trim()) {
      setTaskInput(prev => `${prev} ${timeText}`)
    } else {
      setTaskInput(timeText)
    }
  }

  const handleSubmit = () => {
    if (taskInput.trim() && onTaskCreate) {
      onTaskCreate(taskInput.trim())
      setTaskInput('')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Card className={cn("border-0 bg-transparent text-white shadow-none", className)}>
      <CardHeader className="pb-3 px-0 pt-0">
        <CardTitle className="flex items-center gap-2 text-lg text-white font-medium">
          <Clock className="h-5 w-5 text-blue-300" />
          智能时间助手
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-0">
        {/* 当前时间显示 */}
        <div className="flex items-center gap-2 p-3 bg-white/10 dark:bg-white/10 border border-white/10 rounded-xl">
          <Calendar className="h-4 w-4 text-blue-300" />
          <span className="text-sm font-medium text-white/90">
            {currentTime.formatted.datetime}
          </span>
          <Badge className="bg-blue-500/20 text-blue-200 border border-blue-500/30 font-normal">
            {currentTime.timeOfDay}
          </Badge>
        </div>

        {/* 快速时间选择 */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">快速时间选择</h4>
          <div className="grid grid-cols-2 gap-2">
            {suggestedTimes.map((timeSlot, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickTimeInsert(timeSlot)}
                className="justify-start text-left h-auto p-2.5 border-white/10 dark:border-white/10 bg-white/5 dark:bg-white/5 hover:bg-white/10 dark:hover:bg-white/10 text-white hover:text-white rounded-xl"
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium text-xs text-white/80">{timeSlot.label}</span>
                  <span className="text-[10px] text-white/50 mt-0.5">
                    {TimeUtils.formatForDisplay(timeSlot.startTime, 'HH:mm')} - {TimeUtils.formatForDisplay(timeSlot.endTime, 'HH:mm')}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        </div>

        {/* 任务输入 */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">任务描述</h4>
          <div className="flex gap-2">
            <Input
              value={taskInput}
              onChange={(e) => setTaskInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="描述你的任务，例如：明天上午复习数学，或者2小时后开会..."
              className="flex-1 bg-white/5 dark:bg-white/5 border-white/10 dark:border-white/10 text-white placeholder:text-white/40 rounded-xl focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0"
            />
            <Button 
              onClick={handleSubmit}
              disabled={!taskInput.trim()}
              size="sm"
              className="bg-white hover:bg-white/90 text-gray-900 rounded-xl px-3 shrink-0"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 时间表达式提示 */}
        <div className="p-3 bg-white/5 dark:bg-white/5 border border-white/10 rounded-xl">
          <h4 className="text-xs font-semibold text-white/80 mb-2">💡 支持的时间表达式</h4>
          <div className="grid grid-cols-2 gap-2 text-xs text-white/60">
            <div>• 今天/明天/后天</div>
            <div>• 上午/下午/晚上</div>
            <div>• 2小时后/30分钟后</div>
            <div>• 下周一/下个月</div>
            <div>• 具体时间：9:00</div>
            <div>• 具体日期：1月15日</div>
          </div>
        </div>

        {/* 示例任务 */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/60 uppercase tracking-wider">💭 示例任务</h4>
          <div className="space-y-1">
            {[
              '明天上午9点复习高数第三章',
              '今天下午2点小组讨论项目',
              '2小时后提交作业',
              '下周一上午准备期末考试'
            ].map((example, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => setTaskInput(example)}
                className="justify-start text-left h-auto py-2 px-3 text-xs text-white/70 hover:text-white hover:bg-white/10 dark:hover:bg-white/10 rounded-lg w-full"
              >
                <Zap className="h-3 w-3 mr-2 text-yellow-300 animate-pulse" />
                {example}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
