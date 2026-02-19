/**
 * 用户数据模型
 */

import mongoose, { Document, Schema } from 'mongoose'
import bcrypt from 'bcryptjs'

// 用户状态枚举
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  DELETED = 'deleted'
}

// 用户角色枚举
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator'
}

// 登录方式枚举
export enum LoginMethod {
  EMAIL = 'email',
  USERNAME = 'username'
}

// 用户偏好设置接口
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system'
  language: 'zh-CN' | 'en-US'
  aiPersonality: {
    tone: 'encouraging' | 'professional' | 'casual' | 'formal'
    formality: 'casual' | 'formal'
    responseLength: 'short' | 'medium' | 'long'
  }
  notifications: {
    email: boolean
    push: boolean
    taskReminders: boolean
  }
}

// 用户统计信息接口
export interface UserStatistics {
  totalConversations: number
  totalMessages: number
  avgEmotionScore?: number
  lastActiveAt?: Date
  joinedAt: Date
  // 学习统计
  studyStats: {
    totalStudyTime: number // 分钟
    completedTasks: number
    plannedTasks: number
    averageTaskCompletion: number // 百分比
  }
  // 情绪统计
  emotionStats: {
    weeklyAverage: number
    monthlyTrend: number[]
    mostCommonTags: string[]
  }
}

// 用户文档接口
export interface IUser extends Document {
  _id: string

  // 基本登录信息
  username?: string       // 用户名（可选，用于传统登录）
  email?: string         // 邮箱（可选，用于传统登录）
  password?: string      // 密码（可选，用于传统登录）

  // 用户资料
  profile: {
    name: string
    displayName?: string   // 显示名称
    email?: string
    avatar?: string
    department?: string
    jobTitle?: string
    bio?: string          // 个人简介
    phone?: string        // 手机号
    location?: string     // 地理位置
    website?: string      // 个人网站
  }

  // 账户状态和角色
  status: UserStatus
  role: UserRole
  isEmailVerified: boolean
  isPhoneVerified: boolean

  // 安全信息
  lastLoginAt?: Date
  lastLoginIP?: string
  loginAttempts: number
  lockUntil?: Date
  isLocked?: boolean
  loginMethod: LoginMethod  // 最后使用的登录方式

  // 验证信息
  emailVerificationToken?: string
  emailVerificationExpires?: Date
  passwordResetToken?: string
  passwordResetExpires?: Date

  preferences: UserPreferences
  statistics: UserStatistics

  createdAt: Date
  updatedAt: Date

  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>
  incLoginAttempts(): Promise<any>
  resetLoginAttempts(): Promise<any>
  updateLastActive(): Promise<any>
  incrementMessageCount(): Promise<any>
  updateEmotionStats(emotionScore: number, tags: string[]): Promise<any>
}

// 用户Schema定义
const userSchema = new Schema<IUser>({
  // 基本登录信息
  username: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    minlength: [3, '用户名至少需要3个字符'],
    maxlength: [30, '用户名不能超过30个字符'],
    match: [/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符']
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
  },
  password: {
    type: String,
    minlength: [6, '密码至少需要6个字符']
  },

  // 用户资料
  profile: {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 50
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, '请输入有效的邮箱地址']
    },
    avatar: {
      type: String,
      trim: true
    },
    department: {
      type: String,
      trim: true,
      maxlength: 100
    },
    jobTitle: {
      type: String,
      trim: true,
      maxlength: 100
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500
    },
    phone: {
      type: String,
      trim: true,
      match: [/^1[3-9]\d{9}$/, '请输入有效的手机号码']
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+/, '请输入有效的网站URL']
    }
  },

  // 账户状态和角色
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.ACTIVE
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    default: UserRole.USER
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },

  // 安全信息
  lastLoginAt: Date,
  lastLoginIP: String,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  loginMethod: {
    type: String,
    enum: Object.values(LoginMethod),
    default: LoginMethod.EMAIL
  },

  // 验证信息
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,

  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light'
    },
    language: {
      type: String,
      enum: ['zh-CN', 'en-US'],
      default: 'zh-CN'
    },
    aiPersonality: {
      tone: {
        type: String,
        enum: ['encouraging', 'professional', 'casual', 'formal'],
        default: 'encouraging'
      },
      formality: {
        type: String,
        enum: ['casual', 'formal'],
        default: 'casual'
      },
      responseLength: {
        type: String,
        enum: ['short', 'medium', 'long'],
        default: 'medium'
      }
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      taskReminders: { type: Boolean, default: true }
    }
  },
  statistics: {
    totalConversations: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    avgEmotionScore: { type: Number, min: 0, max: 10 },
    lastActiveAt: { type: Date, default: Date.now },
    joinedAt: { type: Date, default: Date.now },
    studyStats: {
      totalStudyTime: { type: Number, default: 0 },
      completedTasks: { type: Number, default: 0 },
      plannedTasks: { type: Number, default: 0 },
      averageTaskCompletion: { type: Number, default: 0, min: 0, max: 100 }
    },
    emotionStats: {
      weeklyAverage: { type: Number, default: 5, min: 0, max: 10 },
      monthlyTrend: [{ type: Number, min: 0, max: 10 }],
      mostCommonTags: [String]
    }
  }
}, {
  timestamps: true,
  collection: 'users'
})

// 索引定义 - 只在服务器端执行
if (typeof window === 'undefined') {
  userSchema.index({ username: 1 }, { sparse: true })
  userSchema.index({ email: 1 }, { sparse: true })
  userSchema.index({ 'profile.email': 1 })
  userSchema.index({ status: 1, role: 1 })
  userSchema.index({ 'statistics.lastActiveAt': -1 })
  userSchema.index({ createdAt: -1 })
  userSchema.index({ lastLoginAt: -1 })
}

// 虚拟字段
userSchema.virtual('isLocked').get(function () {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now())
})

userSchema.virtual('displayName').get(function () {
  return this.profile.displayName || this.profile.name || this.username
})

// 实例方法
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false
  return bcrypt.compare(candidatePassword, this.password)
}

userSchema.methods.incLoginAttempts = function () {
  // 如果之前有锁定且已过期，重置尝试次数
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    })
  }

  const updates: any = { $inc: { loginAttempts: 1 } }

  // 如果达到最大尝试次数且当前未锁定，则锁定账户
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 } // 锁定2小时
  }

  return this.updateOne(updates)
}

userSchema.methods.resetLoginAttempts = function () {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  })
}

userSchema.methods.updateLastActive = function () {
  this.statistics.lastActiveAt = new Date()
  this.lastLoginAt = new Date()
  return this.save()
}

userSchema.methods.incrementMessageCount = function () {
  this.statistics.totalMessages += 1
  this.statistics.lastActiveAt = new Date()
  return this.save()
}

userSchema.methods.updateEmotionStats = function (emotionScore: number, tags: string[]) {
  // 更新平均情绪分数
  if (this.statistics.avgEmotionScore) {
    this.statistics.avgEmotionScore = (this.statistics.avgEmotionScore + emotionScore) / 2
  } else {
    this.statistics.avgEmotionScore = emotionScore
  }

  // 更新常见标签
  tags.forEach(tag => {
    if (!this.statistics.emotionStats.mostCommonTags.includes(tag)) {
      this.statistics.emotionStats.mostCommonTags.push(tag)
    }
  })

  // 限制标签数量
  if (this.statistics.emotionStats.mostCommonTags.length > 10) {
    this.statistics.emotionStats.mostCommonTags = this.statistics.emotionStats.mostCommonTags.slice(0, 10)
  }

  return this.save()
}

// 静态方法
userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({
    $or: [
      { email: email.toLowerCase() },
      { 'profile.email': email.toLowerCase() }
    ],
    status: { $ne: UserStatus.DELETED }
  })
}

userSchema.statics.findByUsername = function (username: string) {
  return this.findOne({
    username,
    status: { $ne: UserStatus.DELETED }
  })
}

userSchema.statics.getActiveUsers = function (limit = 100) {
  return this.find({ status: UserStatus.ACTIVE })
    .sort({ 'statistics.lastActiveAt': -1 })
    .limit(limit)
}

// 中间件
userSchema.pre('save', async function (next) {
  // 密码加密
  if (this.isModified('password') && this.password) {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
  }

  // 设置显示名称默认值
  if (this.isNew && !this.profile.displayName) {
    this.profile.displayName = this.profile.name || this.username
  }

  // 新用户初始化
  if (this.isNew) {
    this.statistics.joinedAt = new Date()
    this.statistics.lastActiveAt = new Date()
  }

  next()
})

// 导出模型 - 只在服务器端创建
export const User = (typeof window === 'undefined')
  ? (mongoose.models.User || mongoose.model<IUser>('User', userSchema))
  : null as any

export default User
