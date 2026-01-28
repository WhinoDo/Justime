/**
 * 认证相关类型定义
 * 这个文件可以安全地在客户端和服务器端使用
 */

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



// 用户资料接口
export interface UserProfile {
  name: string
  displayName?: string
  email?: string
  avatar?: string
  department?: string
  jobTitle?: string
  bio?: string
  phone?: string
  location?: string
  website?: string
}

// 用户偏好设置接口
export interface UserPreferences {
  language: string
  timezone: string
  theme: string
  notifications: {
    email: boolean
    push: boolean
  }
  privacy: {
    profileVisible: boolean
    activityVisible: boolean
  }
}

// 用户统计信息接口
export interface UserStatistics {
  totalSessions: number
  totalMessages: number
  totalTokens: number
  joinedAt: Date
  lastActiveAt: Date
  avgEmotionScore: number
  emotionStats: {
    mostCommonTags: string[]
    emotionHistory: Array<{
      date: Date
      score: number
      tags: string[]
    }>
  }
}

// 客户端安全的用户信息接口
export interface SafeUser {
  id: string
  username?: string
  email?: string
  displayName: string
  profile: UserProfile
  isEmailVerified: boolean
  isPhoneVerified?: boolean
  isPhoneVerified?: boolean
  role: UserRole
  status?: UserStatus
  preferences?: UserPreferences
  statistics?: UserStatistics
  lastLoginAt?: string
  createdAt?: string
}

// 认证结果接口
export interface AuthResult {
  success: boolean
  user?: SafeUser
  token?: string
  refreshToken?: string
  error?: string
  needsVerification?: boolean
}

// 登录数据接口
export interface LoginData {
  identifier: string
  password: string
  rememberMe?: boolean
}

// 注册数据接口
export interface RegisterData {
  username?: string
  email: string
  password: string
  displayName?: string
  phone?: string
}

// JWT载荷接口
export interface TokenPayload {
  userId: string
  username?: string
  email?: string
  role: UserRole
  loginMethod: LoginMethod
  iat?: number
  exp?: number
}
