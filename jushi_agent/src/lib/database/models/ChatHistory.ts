/**
 * 聊天记录数据模型
 */

import mongoose, { Document, Schema } from 'mongoose'

// 消息类型枚举
export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

// 消息状态枚举
export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  ERROR = 'error'
}

// 单条消息接口
export interface IChatMessage {
  id: string
  type: MessageType
  content: string
  timestamp: Date
  status: MessageStatus
  metadata?: {
    emotionAnalysis?: {
      emotion: string
      confidence: number
      suggestions?: string[]
    }
    taskExtraction?: {
      tasks: Array<{
        title: string
        description: string
        priority: 'high' | 'medium' | 'low'
        estimatedTime?: number
      }>
    }
    responseTime?: number // AI响应时间(ms)
    tokenCount?: number   // 消息token数量
    model?: string        // 使用的AI模型
  }
}

// 聊天会话接口
export interface IChatSession extends Document {
  _id: string
  userId: string           // 关联的用户ID
  sessionId: string        // 会话唯一标识
  title: string           // 会话标题
  messages: IChatMessage[] // 消息列表
  
  // 会话统计
  stats: {
    messageCount: number    // 消息总数
    userMessageCount: number // 用户消息数
    assistantMessageCount: number // AI消息数
    totalTokens: number     // 总token数
    averageResponseTime: number // 平均响应时间
  }
  
  // 会话元数据
  metadata: {
    startTime: Date         // 会话开始时间
    lastActiveTime: Date    // 最后活跃时间
    duration: number        // 会话持续时间(秒)
    emotionTrend: string[]  // 情绪变化趋势
    mainTopics: string[]    // 主要话题
    taskCount: number       // 提取的任务数量
  }
  
  // 会话设置
  settings: {
    autoSave: boolean       // 自动保存
    emotionAnalysis: boolean // 情绪分析
    taskExtraction: boolean  // 任务提取
    isPrivate: boolean      // 是否私密
    tags: string[]          // 标签
  }
  
  status: 'active' | 'archived' | 'deleted'
  createdAt: Date
  updatedAt: Date
}

// 消息Schema
const chatMessageSchema = new Schema<IChatMessage>({
  id: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: Object.values(MessageType),
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: [10000, '消息内容不能超过10000个字符']
  },
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  status: {
    type: String,
    enum: Object.values(MessageStatus),
    default: MessageStatus.SENT
  },
  metadata: {
    emotionAnalysis: {
      emotion: String,
      confidence: Number,
      suggestions: [String]
    },
    taskExtraction: {
      tasks: [{
        title: String,
        description: String,
        priority: {
          type: String,
          enum: ['high', 'medium', 'low']
        },
        estimatedTime: Number
      }]
    },
    responseTime: Number,
    tokenCount: Number,
    model: String
  }
}, { _id: false })

// 聊天会话Schema
const chatSessionSchema = new Schema<IChatSession>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    maxlength: [200, '会话标题不能超过200个字符'],
    default: '新对话'
  },
  messages: [chatMessageSchema],
  
  stats: {
    messageCount: { type: Number, default: 0 },
    userMessageCount: { type: Number, default: 0 },
    assistantMessageCount: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 }
  },
  
  metadata: {
    startTime: { type: Date, default: Date.now },
    lastActiveTime: { type: Date, default: Date.now },
    duration: { type: Number, default: 0 },
    emotionTrend: [String],
    mainTopics: [String],
    taskCount: { type: Number, default: 0 }
  },
  
  settings: {
    autoSave: { type: Boolean, default: true },
    emotionAnalysis: { type: Boolean, default: true },
    taskExtraction: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false },
    tags: [String]
  },
  
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  }
}, {
  timestamps: true,
  collection: 'chat_sessions'
})

// 索引定义 - 只在服务器端执行
if (typeof window === 'undefined') {
  chatSessionSchema.index({ userId: 1, status: 1 })
  chatSessionSchema.index({ userId: 1, createdAt: -1 })
  chatSessionSchema.index({ sessionId: 1 })
  chatSessionSchema.index({ 'metadata.lastActiveTime': -1 })
  chatSessionSchema.index({ 'settings.tags': 1 })

  // 复合索引
  chatSessionSchema.index({ userId: 1, status: 1, 'metadata.lastActiveTime': -1 })
}

// 实例方法
chatSessionSchema.methods.addMessage = function(message: Omit<IChatMessage, 'timestamp'>) {
  const newMessage: IChatMessage = {
    ...message,
    timestamp: new Date()
  }
  
  this.messages.push(newMessage)
  this.updateStats()
  this.metadata.lastActiveTime = new Date()
  
  return this.save()
}

chatSessionSchema.methods.updateStats = function() {
  const messages = this.messages
  
  this.stats.messageCount = messages.length
  this.stats.userMessageCount = messages.filter(m => m.type === MessageType.USER).length
  this.stats.assistantMessageCount = messages.filter(m => m.type === MessageType.ASSISTANT).length
  
  // 计算总token数
  this.stats.totalTokens = messages.reduce((sum, msg) => {
    return sum + (msg.metadata?.tokenCount || 0)
  }, 0)
  
  // 计算平均响应时间
  const responseTimes = messages
    .filter(m => m.metadata?.responseTime)
    .map(m => m.metadata!.responseTime!)
  
  if (responseTimes.length > 0) {
    this.stats.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
  }
  
  // 更新会话持续时间
  if (messages.length > 0) {
    const startTime = messages[0].timestamp
    const endTime = messages[messages.length - 1].timestamp
    this.metadata.duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
  }
  
  // 更新情绪趋势
  const emotions = messages
    .filter(m => m.metadata?.emotionAnalysis?.emotion)
    .map(m => m.metadata!.emotionAnalysis!.emotion)
  
  this.metadata.emotionTrend = emotions
  
  // 更新任务数量
  this.metadata.taskCount = messages.reduce((sum, msg) => {
    return sum + (msg.metadata?.taskExtraction?.tasks?.length || 0)
  }, 0)
}

chatSessionSchema.methods.generateTitle = function() {
  if (this.messages.length === 0) {
    this.title = '新对话'
    return
  }
  
  // 使用第一条用户消息的前30个字符作为标题
  const firstUserMessage = this.messages.find(m => m.type === MessageType.USER)
  if (firstUserMessage) {
    this.title = firstUserMessage.content.substring(0, 30) + (firstUserMessage.content.length > 30 ? '...' : '')
  } else {
    this.title = `对话 ${new Date().toLocaleDateString()}`
  }
}

chatSessionSchema.methods.archive = function() {
  this.status = 'archived'
  return this.save()
}

chatSessionSchema.methods.restore = function() {
  this.status = 'active'
  return this.save()
}

chatSessionSchema.methods.softDelete = function() {
  this.status = 'deleted'
  return this.save()
}

// 静态方法
chatSessionSchema.statics.findByUserId = function(userId: string, status: string = 'active') {
  return this.find({ userId, status }).sort({ 'metadata.lastActiveTime': -1 })
}

chatSessionSchema.statics.findActiveByUserId = function(userId: string) {
  return this.findOne({ userId, status: 'active' }).sort({ 'metadata.lastActiveTime': -1 })
}

chatSessionSchema.statics.createNewSession = function(userId: string, sessionId?: string) {
  return this.create({
    userId,
    sessionId: sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    title: '新对话',
    messages: [],
    metadata: {
      startTime: new Date(),
      lastActiveTime: new Date()
    }
  })
}

// 中间件
chatSessionSchema.pre('save', function(next) {
  // 自动生成标题
  if (this.isNew || this.title === '新对话') {
    this.generateTitle()
  }
  
  // 更新统计信息
  this.updateStats()
  
  next()
})

// 虚拟字段
chatSessionSchema.virtual('isActive').get(function() {
  return this.status === 'active'
})

chatSessionSchema.virtual('lastMessage').get(function() {
  return this.messages.length > 0 ? this.messages[this.messages.length - 1] : null
})

chatSessionSchema.virtual('duration').get(function() {
  return this.metadata.duration
})

// 导出模型 - 只在服务器端创建
export const ChatSession = (typeof window === 'undefined')
  ? (mongoose.models.ChatSession || mongoose.model<IChatSession>('ChatSession', chatSessionSchema))
  : null as any

export default ChatSession
