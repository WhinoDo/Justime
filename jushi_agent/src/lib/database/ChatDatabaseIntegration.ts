/**
 * 聊天系统与数据库集成
 */

import { FeishuTokenManager } from '@/lib/feishu/token-manager'
// 导入类型定义（安全的客户端导入）
import type { EmotionAnalysis, TaskData } from './models/Conversation'

export interface ChatUser {
  id: string
  feishuOpenId: string
  name: string
  email?: string
  avatar?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  emotionAnalysis?: EmotionAnalysis
  taskData?: TaskData
}

export interface ChatConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: Date
  updatedAt: Date
}

export class ChatDatabaseIntegration {
  private static instance: ChatDatabaseIntegration
  private currentUser: ChatUser | null = null
  private currentConversation: ChatConversation | null = null

  private constructor() {}

  static getInstance(): ChatDatabaseIntegration {
    if (!ChatDatabaseIntegration.instance) {
      ChatDatabaseIntegration.instance = new ChatDatabaseIntegration()
    }
    return ChatDatabaseIntegration.instance
  }

  /**
   * 初始化用户会话
   */
  async initializeUser(): Promise<ChatUser | null> {
    try {
      // 只在服务器端或有效环境中执行
      if (typeof window !== 'undefined') {
        console.log('📊 客户端环境，跳过数据库初始化')
        return null
      }

      // 获取飞书用户信息
      const session = FeishuTokenManager.getLoginSession()
      if (!session?.userInfo) {
        console.log('📊 用户未登录，跳过数据库初始化')
        return null
      }

      const feishuUser = session.userInfo

      // 动态导入服务层
      const { UserService } = await import('./services/UserService')

      // 创建或更新用户
      const user = await UserService.findOrCreateUser({
        openId: feishuUser.open_id || feishuUser.openId,
        userId: feishuUser.user_id || feishuUser.userId,
        name: feishuUser.name,
        email: feishuUser.email,
        avatar: feishuUser.avatar,
        department: feishuUser.department,
        jobTitle: feishuUser.job_title
      })

      this.currentUser = {
        id: user._id,
        feishuOpenId: user.feishuOpenId,
        name: user.profile.name,
        email: user.profile.email,
        avatar: user.profile.avatar
      }

      console.log('✅ 用户会话已初始化:', this.currentUser.name)
      return this.currentUser

    } catch (error) {
      console.error('❌ 初始化用户会话失败:', error)
      return null
    }
  }

  /**
   * 创建新对话
   */
  async createConversation(title?: string): Promise<ChatConversation | null> {
    try {
      // 只在服务器端执行
      if (typeof window !== 'undefined') {
        console.log('📊 客户端环境，跳过对话创建')
        return null
      }

      if (!this.currentUser) {
        await this.initializeUser()
        if (!this.currentUser) {
          console.log('📊 用户未登录，无法创建对话')
          return null
        }
      }

      // 动态导入服务层
      const { ConversationService } = await import('./services/ConversationService')

      const conversationTitle = title || this.generateConversationTitle()
      const conversation = await ConversationService.createConversation(
        this.currentUser.id,
        conversationTitle,
        'general'
      )

      this.currentConversation = {
        id: conversation._id,
        title: conversation.title,
        messages: [],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }

      console.log('✅ 新对话已创建:', this.currentConversation.title)
      return this.currentConversation

    } catch (error) {
      console.error('❌ 创建对话失败:', error)
      return null
    }
  }

  /**
   * 添加消息到当前对话
   */
  async addMessage(
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      emotionAnalysis?: EmotionAnalysis
      taskData?: TaskData
      processingTime?: number
      model?: string
    }
  ): Promise<ChatMessage | null> {
    try {
      // 只在服务器端执行
      if (typeof window !== 'undefined') {
        console.log('📊 客户端环境，跳过消息添加')
        return null
      }

      // 确保有当前对话
      if (!this.currentConversation) {
        this.currentConversation = await this.createConversation()
        if (!this.currentConversation) {
          return null
        }
      }

      // 动态导入服务层
      const { ConversationService } = await import('./services/ConversationService')

      // 准备消息数据
      const messageData = {
        role,
        content,
        emotionAnalysis: metadata?.emotionAnalysis,
        taskData: metadata?.taskData,
        metadata: {
          processingTime: metadata?.processingTime,
          model: metadata?.model,
          wordCount: content.length,
          version: '1.0.0'
        }
      }

      // 添加到数据库
      const conversation = await ConversationService.addMessage(
        this.currentConversation.id,
        messageData
      )

      // 获取新添加的消息
      const newMessage = conversation.messages[conversation.messages.length - 1]

      const chatMessage: ChatMessage = {
        id: newMessage.messageId,
        role: newMessage.role,
        content: newMessage.content,
        timestamp: newMessage.timestamp,
        emotionAnalysis: newMessage.emotionAnalysis,
        taskData: newMessage.taskData
      }

      // 更新本地对话
      this.currentConversation.messages.push(chatMessage)
      this.currentConversation.updatedAt = new Date()

      console.log('✅ 消息已添加到对话:', role, content.substring(0, 50) + '...')
      return chatMessage

    } catch (error) {
      console.error('❌ 添加消息失败:', error)
      return null
    }
  }

  /**
   * 获取用户对话历史
   */
  async getUserConversations(page = 1, limit = 20): Promise<ChatConversation[]> {
    try {
      // 只在服务器端执行
      if (typeof window !== 'undefined') {
        console.log('📊 客户端环境，跳过对话历史获取')
        return []
      }

      if (!this.currentUser) {
        await this.initializeUser()
        if (!this.currentUser) {
          return []
        }
      }

      // 动态导入服务层
      const { ConversationService } = await import('./services/ConversationService')

      const result = await ConversationService.getUserConversations(
        this.currentUser.id,
        { page, limit }
      )

      return result.conversations.map(conv => ({
        id: conv._id,
        title: conv.title,
        messages: conv.messages.map(msg => ({
          id: msg.messageId,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          emotionAnalysis: msg.emotionAnalysis,
          taskData: msg.taskData
        })),
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      }))

    } catch (error) {
      console.error('❌ 获取对话历史失败:', error)
      return []
    }
  }

  /**
   * 搜索对话
   */
  async searchConversations(query: string): Promise<ChatConversation[]> {
    try {
      // 只在服务器端执行
      if (typeof window !== 'undefined') {
        console.log('📊 客户端环境，跳过对话搜索')
        return []
      }

      if (!this.currentUser) {
        return []
      }

      // 动态导入服务层
      const { ConversationService } = await import('./services/ConversationService')

      const result = await ConversationService.searchConversations(
        this.currentUser.id,
        query
      )

      return result.conversations.map(conv => ({
        id: conv._id,
        title: conv.title,
        messages: [],
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt
      }))

    } catch (error) {
      console.error('❌ 搜索对话失败:', error)
      return []
    }
  }

  /**
   * 获取用户统计信息
   */
  async getUserStats(): Promise<any> {
    try {
      // 只在服务器端执行
      if (typeof window !== 'undefined') {
        console.log('📊 客户端环境，跳过用户统计获取')
        return null
      }

      if (!this.currentUser) {
        return null
      }

      // 动态导入服务层
      const { UserService } = await import('./services/UserService')

      return await UserService.getUserStatsReport(this.currentUser.id)

    } catch (error) {
      console.error('❌ 获取用户统计失败:', error)
      return null
    }
  }

  /**
   * 获取情绪分析统计
   */
  async getEmotionAnalytics(days = 30): Promise<any> {
    try {
      // 只在服务器端执行
      if (typeof window !== 'undefined') {
        console.log('📊 客户端环境，跳过情绪分析统计获取')
        return null
      }

      if (!this.currentUser) {
        return null
      }

      // 动态导入服务层
      const { ConversationService } = await import('./services/ConversationService')

      return await ConversationService.getEmotionAnalytics(this.currentUser.id, days)

    } catch (error) {
      console.error('❌ 获取情绪分析统计失败:', error)
      return null
    }
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<boolean> {
    try {
      // 只在服务器端执行
      if (typeof window !== 'undefined') {
        console.log('📊 客户端环境，跳过任务状态更新')
        return false
      }

      if (!this.currentConversation) {
        return false
      }

      // 动态导入服务层
      const { ConversationService } = await import('./services/ConversationService')

      return await ConversationService.updateTaskStatus(
        this.currentConversation.id,
        taskId,
        status,
        this.currentUser?.id
      )

    } catch (error) {
      console.error('❌ 更新任务状态失败:', error)
      return false
    }
  }

  /**
   * 生成对话标题
   */
  private generateConversationTitle(): string {
    const now = new Date()
    const timeStr = now.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
    return `对话 ${timeStr}`
  }

  /**
   * 获取当前用户
   */
  getCurrentUser(): ChatUser | null {
    return this.currentUser
  }

  /**
   * 获取当前对话
   */
  getCurrentConversation(): ChatConversation | null {
    return this.currentConversation
  }

  /**
   * 设置当前对话
   */
  setCurrentConversation(conversationId: string): void {
    // 这里可以加载指定的对话
    console.log('🔄 切换到对话:', conversationId)
  }

  /**
   * 清除当前会话
   */
  clearSession(): void {
    this.currentUser = null
    this.currentConversation = null
    console.log('🧹 会话已清除')
  }
}

// 导出单例实例
export const chatDB = ChatDatabaseIntegration.getInstance()

export default chatDB
