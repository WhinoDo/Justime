/**
 * 对话数据模型
 */

import mongoose, { Document, Schema } from 'mongoose'

// 情绪分析数据接口
export interface EmotionAnalysis {
  score: number // 1-10
  tags: string[]
  context?: string
  confidence?: number
}

// 任务数据接口
export interface TaskData {
  hasTasks: boolean
  tasks: Array<{
    id: string
    title: string
    description?: string
    startTime?: Date
    endTime?: Date
    priority: 'low' | 'medium' | 'high'
    category?: string
    location?: string
    reminders?: number[] // 提前提醒分钟数
    status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  }>
}



// 消息接口
export interface IMessage {
  messageId: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date

  // 用户消息的情绪分析
  emotionAnalysis?: EmotionAnalysis

  // AI响应的任务数据
  taskData?: TaskData

  // 消息元数据
  metadata?: {
    wordCount?: number
    processingTime?: number // AI响应生成时间(ms)
    model?: string // 使用的AI模型
    version?: string // 系统版本
  }
}

// 对话元数据接口
export interface ConversationMetadata {
  totalMessages: number
  avgEmotionScore?: number
  emotionTrend: number[] // 情绪变化趋势
  hasTaskPlanning: boolean
  taskCount: number
  completedTaskCount: number
  categories: string[] // 对话主题分类
  lastActivity: Date

  // 学习分析
  learningMetrics?: {
    studyTopics: string[]
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced'
    learningGoals: string[]
    progressIndicators: number[]
  }

  // 性能指标
  performance?: {
    avgResponseTime: number // 平均响应时间
    userSatisfaction?: number // 用户满意度评分
    taskCompletionRate?: number // 任务完成率
  }
}

// 对话文档接口
export interface IConversation extends Document {
  _id: string
  userId: string
  title: string
  messages: IMessage[]
  metadata: ConversationMetadata

  // 对话状态
  status: 'active' | 'archived' | 'deleted'

  // 对话类型
  type: 'general' | 'task_planning' | 'emotion_support' | 'learning' | 'mixed'

  // 标签和分类
  tags: string[]

  // 共享设置
  sharing?: {
    isShared: boolean
    sharedWith?: string[] // 用户ID列表
    sharePermissions: 'read' | 'comment' | 'edit'
  }

  createdAt: Date
  updatedAt: Date
}

// 消息Schema
const messageSchema = new Schema<IMessage>({
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000 // 限制消息长度
  },
  timestamp: {
    type: Date,
    default: Date.now
  },

  // 情绪分析数据
  emotionAnalysis: {
    score: {
      type: Number,
      min: 1,
      max: 10
    },
    tags: [String],
    context: String,
    confidence: {
      type: Number,
      min: 0,
      max: 1
    }
  },

  // 任务数据
  taskData: {
    hasTasks: {
      type: Boolean,
      default: false
    },
    tasks: [{
      id: { type: String, required: true },
      title: { type: String, required: true },
      description: String,
      startTime: Date,
      endTime: Date,
      priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
      },
      category: String,
      location: String,
      reminders: [Number],
      status: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'cancelled'],
        default: 'pending'
      }
    }]
  },

  // 消息元数据
  metadata: {
    wordCount: Number,
    processingTime: Number,
    model: String,
    version: String
  }
}, { _id: false })

// 对话Schema
const conversationSchema = new Schema<IConversation>({
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
  messages: [messageSchema],

  metadata: {
    totalMessages: { type: Number, default: 0 },
    avgEmotionScore: { type: Number, min: 1, max: 10 },
    emotionTrend: [{ type: Number, min: 1, max: 10 }],
    hasTaskPlanning: { type: Boolean, default: false },
    taskCount: { type: Number, default: 0 },
    completedTaskCount: { type: Number, default: 0 },
    categories: [String],
    lastActivity: { type: Date, default: Date.now },

    learningMetrics: {
      studyTopics: [String],
      difficultyLevel: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced']
      },
      learningGoals: [String],
      progressIndicators: [Number]
    },

    performance: {
      avgResponseTime: Number,
      userSatisfaction: { type: Number, min: 1, max: 5 },
      taskCompletionRate: { type: Number, min: 0, max: 100 }
    }
  },

  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },

  type: {
    type: String,
    enum: ['general', 'task_planning', 'emotion_support', 'learning', 'mixed'],
    default: 'general'
  },

  tags: [String],

  sharing: {
    isShared: { type: Boolean, default: false },
    sharedWith: [String],
    sharePermissions: {
      type: String,
      enum: ['read', 'comment', 'edit'],
      default: 'read'
    }
  }
}, {
  timestamps: true,
  collection: 'conversations'
})

// 索引定义 - 只在服务器端执行
if (typeof window === 'undefined') {
  conversationSchema.index({ userId: 1, 'metadata.lastActivity': -1 })
  conversationSchema.index({ userId: 1, status: 1 })
  conversationSchema.index({ 'messages.content': 'text', title: 'text' })
  conversationSchema.index({ tags: 1 })
  conversationSchema.index({ type: 1 })
  conversationSchema.index({ createdAt: -1 })
}

// 实例方法
conversationSchema.methods.addMessage = function (messageData: Partial<IMessage>) {
  const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  const message: IMessage = {
    messageId,
    role: messageData.role!,
    content: messageData.content!,
    timestamp: new Date(),
    ...messageData
  }

  this.messages.push(message)
  this.metadata.totalMessages = this.messages.length
  this.metadata.lastActivity = new Date()

  // 更新情绪趋势
  if (message.emotionAnalysis?.score) {
    this.metadata.emotionTrend.push(message.emotionAnalysis.score)
    // 保持最近20个情绪分数
    if (this.metadata.emotionTrend.length > 20) {
      this.metadata.emotionTrend = this.metadata.emotionTrend.slice(-20)
    }

    // 更新平均情绪分数
    const emotionScores = this.metadata.emotionTrend
    this.metadata.avgEmotionScore = emotionScores.reduce((a: number, b: number) => a + b, 0) / emotionScores.length
  }

  // 更新任务统计
  if (message.taskData?.hasTasks) {
    this.metadata.hasTaskPlanning = true
    this.metadata.taskCount += message.taskData.tasks.length
  }

  return this
}

conversationSchema.methods.updateTaskStatus = function (taskId: string, status: string) {
  for (const message of this.messages) {
    if (message.taskData?.tasks) {
      const task = message.taskData.tasks.find((t: any) => t.id === taskId)
      if (task) {
        task.status = status as any
        if (status === 'completed') {
          this.metadata.completedTaskCount += 1
        }
        break
      }
    }
  }
  return this.save()
}

// 静态方法
conversationSchema.statics.findByUserId = function (userId: string, status = 'active') {
  return this.find({ userId, status }).sort({ 'metadata.lastActivity': -1 })
}

conversationSchema.statics.searchConversations = function (userId: string, query: string) {
  return this.find({
    userId,
    status: 'active',
    $text: { $search: query }
  }).sort({ score: { $meta: 'textScore' } })
}

// 导出模型 - 只在服务器端创建
export const Conversation = (typeof window === 'undefined')
  ? (mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', conversationSchema))
  : null as any

export default Conversation
