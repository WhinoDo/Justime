/**
 * 聊天系统与数据库集成（已禁用 - 飞书集成已移除）
 */

// 导入类型定义
import type { EmotionAnalysis } from '@/types'

// 本地定义 TaskData 类型（原模型文件已移除）
export interface TaskData {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
}

export interface ChatUser {
  id: string

  name: string
  email?: string
  avatar?: string
}

export interface ChatConversation {
  id: string
  title: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

/**
 * 聊天数据库集成类（已禁用）
 * 注意：此类依赖飞书集成，已被禁用
 */
class ChatDatabaseIntegration {
  private static instance: ChatDatabaseIntegration
  private currentUser: ChatUser | null = null
  private currentConversation: ChatConversation | null = null

  private constructor() { }

  static getInstance(): ChatDatabaseIntegration {
    if (!ChatDatabaseIntegration.instance) {
      ChatDatabaseIntegration.instance = new ChatDatabaseIntegration()
    }
    return ChatDatabaseIntegration.instance
  }

  /**
   * 所有方法已禁用 - 飞书集成已移除
   */
  async initializeUser(): Promise<ChatUser | null> {
    console.log('📊 用户初始化已禁用（飞书集成已移除）')
    return null
  }

  async createConversation(title?: string): Promise<ChatConversation | null> {
    console.log('📊 创建对话已禁用（飞书集成已移除）')
    return null
  }

  async addMessage(
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      emotion?: EmotionAnalysis
      tasks?: TaskData[]
      tokenCount?: number
      modelUsed?: string
    }
  ): Promise<ChatMessage | null> {
    console.log('📊 添加消息已禁用（飞书集成已移除）')
    return null
  }

  async getUserConversations(page = 1, limit = 20): Promise<ChatConversation[]> {
    console.log('📊 获取对话列表已禁用（飞书集成已移除）')
    return []
  }

  async searchConversations(query: string): Promise<ChatConversation[]> {
    console.log('📊 搜索对话已禁用（飞书集成已移除）')
    return []
  }

  async getUserStats(): Promise<any> {
    console.log('📊 获取用户统计已禁用（飞书集成已移除）')
    return null
  }

  async getEmotionAnalytics(days = 7): Promise<any> {
    console.log('📊 获取情绪分析已禁用（飞书集成已移除）')
    return null
  }

  async updateTaskStatus(
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  ): Promise<boolean> {
    console.log('📊 更新任务状态已禁用（飞书集成已移除）')
    return false
  }

  // 辅助方法
  generateConversationTitle(firstMessage: string): string {
    const maxLength = 30
    const cleaned = firstMessage.trim().replace(/\n+/g, ' ')
    return cleaned.length > maxLength
      ? cleaned.substring(0, maxLength) + '...'
      : cleaned
  }

  getCurrentUser(): ChatUser | null {
    return this.currentUser
  }

  getCurrentConversation(): ChatConversation | null {
    return this.currentConversation
  }

  setCurrentConversation(conversationId: string | null): void {
    // 已禁用
    this.currentConversation = null
  }

  clearSession(): void {
    this.currentUser = null
    this.currentConversation = null
  }
}

// 导出单例实例
export const chatDB = ChatDatabaseIntegration.getInstance()
