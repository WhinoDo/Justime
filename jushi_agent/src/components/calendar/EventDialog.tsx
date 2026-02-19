'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { FileText, Link as LinkIcon, ExternalLink, Plus, Trash2, X } from 'lucide-react'
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
    resources: [] as Array<{ title: string; url: string; type?: string }>,
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
        resources: event.resources || [],
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
        resources: [],
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

  const addResource = () => {
    setFormData({
      ...formData,
      resources: [...(formData.resources || []), { title: '', url: '' }]
    })
  }

  const removeResource = (index: number) => {
    const newResources = [...(formData.resources || [])]
    newResources.splice(index, 1)
    setFormData({ ...formData, resources: newResources })
  }

  const updateResource = (index: number, field: 'title' | 'url', value: string) => {
    const newResources = [...(formData.resources || [])]
    newResources[index] = { ...newResources[index], [field]: value }
    setFormData({ ...formData, resources: newResources })
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

            {/* 资源列表管理 */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>相关资源</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addResource}
                  className="h-6 px-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  添加资源
                </Button>
              </div>

              <div className="grid gap-2">
                {formData.resources && formData.resources.map((resource, i) => (
                  <div key={i} className="flex gap-2 items-start bg-gray-50 dark:bg-gray-800/50 p-2 rounded-lg group">
                    <div className="grid gap-2 flex-1">
                      <Input
                        value={resource.title}
                        onChange={(e) => updateResource(i, 'title', e.target.value)}
                        placeholder="资源名称"
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={resource.url}
                          onChange={(e) => updateResource(i, 'url', e.target.value)}
                          placeholder="URL 链接 (https://...)"
                          className="h-8 text-sm flex-1 font-mono"
                        />
                        {resource.url && (
                          <a
                            href={resource.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200"
                            title="访问链接"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeResource(i)}
                      className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {(!formData.resources || formData.resources.length === 0) && (
                  <div className="text-center py-4 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-lg text-sm text-gray-400">
                    暂无资源
                  </div>
                )}
              </div>
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

          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
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
              {event && event._id && (
                <Link href={`/schedule/${event._id}/document`} passHref>
                  <Button type="button" variant="secondary" className="gap-2">
                    <FileText className="w-4 h-4" />
                    编写工作文档
                  </Button>
                </Link>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
