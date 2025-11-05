/**
 * 飞书应用配置数据模型
 */

import mongoose, { Document, Schema } from 'mongoose'

// 飞书应用配置接口
export interface IFeishuApp extends Document {
  _id: string
  userId: string // 关联的用户ID
  appId: string // 飞书应用ID
  appSecret: string // 飞书应用密钥（加密存储）
  appName?: string // 应用名称
  description?: string // 应用描述
  
  // 应用权限范围
  permissions: {
    calendar: boolean // 日历权限
    contacts: boolean // 通讯录权限
    messages: boolean // 消息权限
    documents: boolean // 文档权限
  }
  
  // 应用状态
  status: 'active' | 'inactive' | 'expired'
  isVerified: boolean // 是否已验证
  
  // 验证信息
  verification: {
    lastVerified?: Date
    verificationToken?: string
    errorMessage?: string
  }
  
  // 使用统计
  usage: {
    totalApiCalls: number
    lastUsed?: Date
    dailyLimit: number
    monthlyLimit: number
  }
  
  createdAt: Date
  updatedAt: Date
}

// 飞书应用Schema
const feishuAppSchema = new Schema<IFeishuApp>({
  userId: {
    type: String,
    required: true,
    index: true
  },
  appId: {
    type: String,
    required: true,
    trim: true,
    match: [/^cli_[a-zA-Z0-9]+$/, '请输入有效的飞书应用ID (格式: cli_xxxxxxxxxx)']
  },
  appSecret: {
    type: String,
    required: true,
    trim: true,
    minlength: [20, '应用密钥长度不能少于20个字符']
  },
  appName: {
    type: String,
    trim: true,
    maxlength: [100, '应用名称不能超过100个字符']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, '应用描述不能超过500个字符']
  },
  
  permissions: {
    calendar: { type: Boolean, default: false },
    contacts: { type: Boolean, default: false },
    messages: { type: Boolean, default: false },
    documents: { type: Boolean, default: false }
  },
  
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired'],
    default: 'inactive'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verification: {
    lastVerified: Date,
    verificationToken: String,
    errorMessage: String
  },
  
  usage: {
    totalApiCalls: { type: Number, default: 0 },
    lastUsed: Date,
    dailyLimit: { type: Number, default: 1000 },
    monthlyLimit: { type: Number, default: 10000 }
  }
}, {
  timestamps: true,
  collection: 'feishu_apps'
})

// 索引定义 - 只在服务器端执行
if (typeof window === 'undefined') {
  feishuAppSchema.index({ userId: 1, status: 1 })
  feishuAppSchema.index({ appId: 1 })
  feishuAppSchema.index({ userId: 1, isVerified: 1 })

  // 复合唯一索引：每个用户只能有一个活跃的应用
  feishuAppSchema.index(
    { userId: 1, status: 1 },
    {
      unique: true,
      partialFilterExpression: { status: 'active' },
      name: 'unique_active_app_per_user'
    }
  )
}

// 实例方法
feishuAppSchema.methods.encrypt = function(text: string): string {
  // 简单的加密实现（生产环境建议使用更强的加密）
  return Buffer.from(text).toString('base64')
}

feishuAppSchema.methods.decrypt = function(encryptedText: string): string {
  try {
    return Buffer.from(encryptedText, 'base64').toString('utf8')
  } catch (error) {
    throw new Error('解密失败')
  }
}

feishuAppSchema.methods.getDecryptedSecret = function(): string {
  return this.decrypt(this.appSecret)
}

feishuAppSchema.methods.updateUsage = function() {
  this.usage.totalApiCalls += 1
  this.usage.lastUsed = new Date()
  return this.save()
}

feishuAppSchema.methods.verify = async function(): Promise<boolean> {
  try {
    // 调用飞书API验证应用配置
    const decryptedSecret = this.getDecryptedSecret()

    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: decryptedSecret
      })
    })

    const data = await response.json()

    if (data.code === 0 && data.app_access_token) {
      this.isVerified = true
      this.verification.lastVerified = new Date()
      this.verification.errorMessage = undefined
      this.status = 'active'

      await this.save()
      return true
    } else {
      this.isVerified = false
      this.verification.errorMessage = data.msg || '应用配置验证失败'
      this.status = 'inactive'

      await this.save()
      return false
    }
  } catch (error) {
    this.isVerified = false
    this.verification.errorMessage = error instanceof Error ? error.message : '验证失败'
    this.status = 'inactive'

    await this.save()
    return false
  }
}

// 静态方法
feishuAppSchema.statics.findActiveByUserId = function(userId: string) {
  return this.findOne({ userId, status: 'active', isVerified: true })
}

feishuAppSchema.statics.findByUserId = function(userId: string) {
  return this.find({ userId }).sort({ createdAt: -1 })
}

// 中间件
feishuAppSchema.pre('save', function(next) {
  // 加密应用密钥
  if (this.isModified('appSecret') && !this.appSecret.includes('=')) {
    // 如果密钥未加密，则进行加密
    this.appSecret = this.encrypt(this.appSecret)
  }
  next()
})

// 虚拟字段
feishuAppSchema.virtual('isExpired').get(function() {
  if (!this.verification.lastVerified) return true
  
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  
  return this.verification.lastVerified < thirtyDaysAgo
})

feishuAppSchema.virtual('remainingDailyLimit').get(function() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // 这里简化处理，实际应该统计今日的API调用次数
  return Math.max(0, this.usage.dailyLimit - (this.usage.totalApiCalls % this.usage.dailyLimit))
})

// 导出模型 - 只在服务器端创建
export const FeishuApp = (typeof window === 'undefined')
  ? (mongoose.models.FeishuApp || mongoose.model<IFeishuApp>('FeishuApp', feishuAppSchema))
  : null as any

export default FeishuApp
