/**
 * 日历事件数据模型
 */

import mongoose, { Document, Schema } from 'mongoose'

// 事件优先级
export enum EventPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

// 事件状态
export enum EventStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// 事件类型
export enum EventType {
  TASK = 'task',
  MEETING = 'meeting',
  REMINDER = 'reminder',
  DEADLINE = 'deadline',
  OTHER = 'other'
}

// 日历事件接口
export interface ICalendarEvent extends Document {
  _id: string
  userId: string           // 用户ID
  title: string           // 事件标题
  description?: string    // 事件描述
  start: Date            // 开始时间
  end: Date              // 结束时间
  allDay: boolean        // 是否全天事件

  // 事件属性
  type: EventType
  priority: EventPriority
  status: EventStatus
  color?: string         // 事件颜色
  location?: string      // 地点

  // 提醒设置
  reminders?: Array<{
    minutes: number      // 提前多少分钟提醒
    sent: boolean        // 是否已发送
  }>

  // AI相关
  emotionScore?: number  // 创建时的情绪分数
  aiGenerated: boolean   // 是否由AI生成
  taskId?: string        // 关联的任务ID

  // 资源列表
  resources?: Array<{
    title: string
    url: string
    type?: string
  }>

  // 元数据
  createdAt: Date
  updatedAt: Date
}

// Schema定义
const calendarEventSchema = new Schema<ICalendarEvent>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  resources: [{
    title: { type: String, required: true },
    url: { type: String, required: true },
    type: { type: String }
  }],
  start: {
    type: Date,
    required: true,
    index: true
  },
  end: {
    type: Date,
    required: true,
    index: true
  },
  allDay: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    enum: Object.values(EventType),
    default: EventType.OTHER
  },
  priority: {
    type: String,
    enum: Object.values(EventPriority),
    default: EventPriority.MEDIUM
  },
  status: {
    type: String,
    enum: Object.values(EventStatus),
    default: EventStatus.PENDING
  },
  color: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: 200
  },
  reminders: [{
    minutes: {
      type: Number,
      required: true
    },
    sent: {
      type: Boolean,
      default: false
    }
  }],
  emotionScore: {
    type: Number,
    min: 0,
    max: 10
  },
  aiGenerated: {
    type: Boolean,
    default: false
  },
  taskId: {
    type: String,
    index: true
  }
}, {
  timestamps: true,
  collection: 'calendar_events'
})

// 索引
if (typeof window === 'undefined') {
  calendarEventSchema.index({ userId: 1, start: 1 })
  calendarEventSchema.index({ userId: 1, end: 1 })
  calendarEventSchema.index({ userId: 1, status: 1 })
  calendarEventSchema.index({ userId: 1, type: 1 })
  calendarEventSchema.index({ start: 1, end: 1 })
}

// 虚拟字段
calendarEventSchema.virtual('duration').get(function () {
  return this.end.getTime() - this.start.getTime()
})

calendarEventSchema.virtual('isUpcoming').get(function () {
  return this.start > new Date() && this.status !== EventStatus.COMPLETED
})

calendarEventSchema.virtual('isPast').get(function () {
  return this.end < new Date()
})

// 实例方法
calendarEventSchema.methods.markCompleted = function () {
  this.status = EventStatus.COMPLETED
  return this.save()
}

calendarEventSchema.methods.markCancelled = function () {
  this.status = EventStatus.CANCELLED
  return this.save()
}

calendarEventSchema.methods.updateTime = function (start: Date, end: Date) {
  this.start = start
  this.end = end
  return this.save()
}

// 静态方法
calendarEventSchema.statics.findByUserId = function (userId: string) {
  return this.find({ userId, status: { $ne: EventStatus.CANCELLED } })
    .sort({ start: 1 })
}

calendarEventSchema.statics.findByDateRange = function (
  userId: string,
  startDate: Date,
  endDate: Date
) {
  return this.find({
    userId,
    status: { $ne: EventStatus.CANCELLED },
    $or: [
      { start: { $gte: startDate, $lte: endDate } },
      { end: { $gte: startDate, $lte: endDate } },
      { start: { $lte: startDate }, end: { $gte: endDate } }
    ]
  }).sort({ start: 1 })
}

calendarEventSchema.statics.findUpcoming = function (userId: string, limit = 10) {
  return this.find({
    userId,
    start: { $gte: new Date() },
    status: { $in: [EventStatus.PENDING, EventStatus.CONFIRMED] }
  })
    .sort({ start: 1 })
    .limit(limit)
}

calendarEventSchema.statics.findByType = function (userId: string, type: EventType) {
  return this.find({
    userId,
    type,
    status: { $ne: EventStatus.CANCELLED }
  }).sort({ start: -1 })
}

// 导出模型
// 防止开发环境下模型缓存导致Schema更新不生效
if (process.env.NODE_ENV === 'development' && mongoose.models.CalendarEvent) {
  delete mongoose.models.CalendarEvent
}

export const CalendarEvent = (typeof window === 'undefined')
  ? (mongoose.models.CalendarEvent || mongoose.model<ICalendarEvent>('CalendarEvent', calendarEventSchema))
  : null as any

export default CalendarEvent
