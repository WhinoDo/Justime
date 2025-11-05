'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Calendar, Clock, FileText, User, X } from 'lucide-react'

interface CalendarEvent {
  event_id: string
  summary: string
  start_time: { timestamp: string }
  end_time: { timestamp: string }
  description?: string
  status?: string
  visibility?: string
}

interface EventModalProps {
  event: CalendarEvent | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (event: CalendarEvent) => void
  onDelete?: (event: CalendarEvent) => void
}

export function EventModal({ event, isOpen, onClose, onEdit, onDelete }: EventModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  if (!event) return null

  const formatDateTime = (timestamp: string) => {
    const date = new Date(parseInt(timestamp) * 1000)
    return {
      date: date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      }),
      time: date.toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const startDateTime = formatDateTime(event.start_time.timestamp)
  const endDateTime = formatDateTime(event.end_time.timestamp)

  const handleDelete = async () => {
    if (!onDelete) return
    
    setIsDeleting(true)
    try {
      await onDelete(event)
      onClose()
    } catch (error) {
      console.error('删除事件失败:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'tentative':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getVisibilityColor = (visibility?: string) => {
    switch (visibility) {
      case 'public':
        return 'bg-blue-100 text-blue-800'
      case 'private':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              日程详情
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* 标题 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {event.summary}
            </h3>
            <div className="flex gap-2">
              {event.status && (
                <Badge className={getStatusColor(event.status)}>
                  {event.status}
                </Badge>
              )}
              {event.visibility && (
                <Badge className={getVisibilityColor(event.visibility)}>
                  {event.visibility}
                </Badge>
              )}
            </div>
          </div>

          {/* 时间信息 */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="font-medium">开始时间</div>
                  <div className="text-sm text-gray-600">
                    {startDateTime.date}
                  </div>
                  <div className="text-sm text-gray-600">
                    {startDateTime.time}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="font-medium">结束时间</div>
                  <div className="text-sm text-gray-600">
                    {endDateTime.date}
                  </div>
                  <div className="text-sm text-gray-600">
                    {endDateTime.time}
                  </div>
                </div>
              </div>

              {/* 持续时间 */}
              <div className="pt-2 border-t">
                <div className="text-sm text-gray-500">
                  持续时间: {(() => {
                    const start = new Date(parseInt(event.start_time.timestamp) * 1000)
                    const end = new Date(parseInt(event.end_time.timestamp) * 1000)
                    const duration = end.getTime() - start.getTime()
                    const hours = Math.floor(duration / (1000 * 60 * 60))
                    const minutes = Math.floor((duration % (1000 * 60 * 60)) / (1000 * 60))
                    
                    if (hours > 0) {
                      return `${hours}小时${minutes > 0 ? ` ${minutes}分钟` : ''}`
                    } else {
                      return `${minutes}分钟`
                    }
                  })()}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 描述 */}
          {event.description && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-gray-500 mt-0.5" />
                  <div>
                    <div className="font-medium mb-1">描述</div>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap">
                      {event.description}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 事件ID */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-gray-500" />
                <div>
                  <div className="font-medium mb-1">事件ID</div>
                  <div className="text-xs text-gray-500 font-mono">
                    {event.event_id}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-4 border-t">
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => onEdit(event)}
                className="flex-1"
              >
                编辑
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1"
              >
                {isDeleting ? '删除中...' : '删除'}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose} className="flex-1">
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
