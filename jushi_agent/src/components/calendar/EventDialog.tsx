'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CalendarEventData } from './BigCalendar'
import { format } from 'date-fns'

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: CalendarEventData | null
  defaultStart?: Date
  defaultEnd?: Date
  onSave: (event: Partial<CalendarEventData>) => Promise<void>
  onDelete?: (eventId: string) => Promise<void>
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  defaultStart,
  defaultEnd,
  onSave,
  onDelete,
}: EventDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start: '',
    end: '',
    allDay: false,
    type: 'other',
    priority: 'medium',
    location: '',
    color: '#3b82f6',
  })
  const [loading, setLoading] = useState(false)

  // 初始化表单数据
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        start: format(new Date(event.start), "yyyy-MM-dd'T'HH:mm"),
        end: format(new Date(event.end), "yyyy-MM-dd'T'HH:mm"),
        allDay: event.allDay || false,
        type: event.type || 'other',
        priority: event.priority || 'medium',
        location: event.location || '',
        color: event.color || '#3b82f6',
      })
    } else if (defaultStart && defaultEnd) {
      setFormData({
        title: '',
        description: '',
        start: format(defaultStart, "yyyy-MM-dd'T'HH:mm"),
        end: format(defaultEnd, "yyyy-MM-dd'T'HH:mm"),
        allDay: false,
        type: 'other',
        priority: 'medium',
        location: '',
        color: '#3b82f6',
      })
    }
  }, [event, defaultStart, defaultEnd])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSave({
        ...formData,
        start: new Date(formData.start),
        end: new Date(formData.end),
      })
      onOpenChange(false)
    } catch (error) {
      console.error('保存事件失败:', error)
      alert('保存失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!event?._id || !onDelete) return
    
    if (confirm('确定要删除这个事件吗？')) {
      setLoading(true)
      try {
        await onDelete(event._id)
        onOpenChange(false)
      } catch (error) {
        console.error('删除事件失败:', error)
        alert('删除失败，请重试')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {event ? '编辑事件' : '创建新事件'}
          </DialogTitle>
          <DialogDescription>
            {event ? '修改事件信息' : '填写事件详情'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {/* 标题 */}
            <div className="grid gap-2">
              <Label htmlFor="title">标题 *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="输入事件标题"
                required
              />
            </div>

            {/* 时间 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start">开始时间 *</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={formData.start}
                  onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end">结束时间 *</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={formData.end}
                  onChange={(e) => setFormData({ ...formData, end: e.target.value })}
                  required
                />
              </div>
            </div>

            {/* 类型和优先级 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="type">类型</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">任务</SelectItem>
                    <SelectItem value="meeting">会议</SelectItem>
                    <SelectItem value="reminder">提醒</SelectItem>
                    <SelectItem value="deadline">截止日期</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">优先级</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">低</SelectItem>
                    <SelectItem value="medium">中</SelectItem>
                    <SelectItem value="high">高</SelectItem>
                    <SelectItem value="urgent">紧急</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 地点 */}
            <div className="grid gap-2">
              <Label htmlFor="location">地点</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="输入地点"
              />
            </div>

            {/* 描述 */}
            <div className="grid gap-2">
              <Label htmlFor="description">描述</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="输入事件描述"
                rows={3}
              />
            </div>

            {/* 颜色 */}
            <div className="grid gap-2">
              <Label htmlFor="color">颜色</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <span className="text-sm text-gray-500">{formData.color}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            {event && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                删除
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
