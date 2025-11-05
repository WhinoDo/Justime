/**
 * 聊天记录服务层
 */

import { ChatSession, IChatSession, IChatMessage, MessageType, MessageStatus } from '../models/ChatHistory'
import { ensureDbConnection } from '../connection'

export interface CreateSessionOptions {
  title?: string
  settings?: {
    autoSave?: boolean
    emotionAnalysis?: boolean
    taskExtraction?: boolean
    isPrivate?: boolean
    tags?: string[]
  }
}

export interface AddMessageOptions {
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
  responseTime?: number
  tokenCount?: number
  model?: string
}

export class ChatHistoryService {
  /**
   * 创建新的聊天会话
   */
  static async createSession(
    userId: string, 
    options: CreateSessionOptions = {}
  ): Promise<IChatSession> {
    await ensureDbConnection()

    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const session = await ChatSession.create({
        userId,
        sessionId,
        title: options.title || '新对话',
        messages: [],
        settings: {
          autoSave: true,
          emotionAnalysis: true,
          taskExtraction: true,
          isPrivate: false,
          tags: [],
          ...options.settings
        },
        metadata: {
          startTime: new Date(),
          lastActiveTime: new Date(),
          duration: 0,
          emotionTrend: [],
          mainTopics: [],
          taskCount: 0
        }
      })

      console.log('✅ 创建聊天会话成功:', sessionId)
      return session

    } catch (error) {
      console.error('❌ 创建聊天会话失败:', error)
      throw new Error('创建聊天会话失败')
    }
  }

  /**
   * 获取用户的活跃会话
   */
  static async getActiveSession(userId: string): Promise<IChatSession | null> {
    await ensureDbConnection()

    try {
      return await ChatSession.findActiveByUserId(userId)
    } catch (error) {
      console.error('❌ 获取活跃会话失败:', error)
      return null
    }
  }

  /**
   * 获取或创建用户的活跃会话
   */
  static async getOrCreateActiveSession(userId: string): Promise<IChatSession> {
    await ensureDbConnection()

    try {
      let session = await this.getActiveSession(userId)
      
      if (!session) {
        session = await this.createSession(userId)
      }

      return session

    } catch (error) {
      console.error('❌ 获取或创建活跃会话失败:', error)
      throw error
    }
  }

  /**
   * 添加消息到会话
   */
  static async addMessage(
    sessionId: string,
    type: MessageType,
    content: string,
    options: AddMessageOptions = {}
  ): Promise<IChatSession> {
    await ensureDbConnection()

    try {
      const session = await ChatSession.findOne({ sessionId })
      if (!session) {
        throw new Error('会话不存在')
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const message: Omit<IChatMessage, 'timestamp'> = {
        id: messageId,
        type,
        content,
        status: MessageStatus.SENT,
        metadata: {
          emotionAnalysis: options.emotionAnalysis,
          taskExtraction: options.taskExtraction,
          responseTime: options.responseTime,
          tokenCount: options.tokenCount,
          model: options.model
        }
      }

      await session.addMessage(message)
      console.log('✅ 添加消息成功:', messageId)

      return session

    } catch (error) {
      console.error('❌ 添加消息失败:', error)
      throw error
    }
  }

  /**
   * 批量添加消息到会话
   */
  static async addMessages(
    sessionId: string,
    messages: Array<{
      type: MessageType
      content: string
      options?: AddMessageOptions
    }>
  ): Promise<IChatSession> {
    await ensureDbConnection()

    try {
      const session = await ChatSession.findOne({ sessionId })
      if (!session) {
        throw new Error('会话不存在')
      }

      for (const msg of messages) {
        const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        const message: Omit<IChatMessage, 'timestamp'> = {
          id: messageId,
          type: msg.type,
          content: msg.content,
          status: MessageStatus.SENT,
          metadata: {
            emotionAnalysis: msg.options?.emotionAnalysis,
            taskExtraction: msg.options?.taskExtraction,
            responseTime: msg.options?.responseTime,
            tokenCount: msg.options?.tokenCount,
            model: msg.options?.model
          }
        }

        await session.addMessage(message)
      }

      console.log(`✅ 批量添加 ${messages.length} 条消息成功`)
      return session

    } catch (error) {
      console.error('❌ 批量添加消息失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的所有会话
   */
  static async getUserSessions(
    userId: string,
    status: 'active' | 'archived' | 'deleted' = 'active',
    limit: number = 50,
    offset: number = 0
  ): Promise<IChatSession[]> {
    await ensureDbConnection()

    try {
      return await ChatSession
        .find({ userId, status })
        .sort({ 'metadata.lastActiveTime': -1 })
        .limit(limit)
        .skip(offset)

    } catch (error) {
      console.error('❌ 获取用户会话失败:', error)
      return []
    }
  }

  /**
   * 获取会话详情
   */
  static async getSession(sessionId: string): Promise<IChatSession | null> {
    await ensureDbConnection()

    try {
      return await ChatSession.findOne({ sessionId })
    } catch (error) {
      console.error('❌ 获取会话详情失败:', error)
      return null
    }
  }

  /**
   * 更新会话标题
   */
  static async updateSessionTitle(sessionId: string, title: string): Promise<boolean> {
    await ensureDbConnection()

    try {
      const result = await ChatSession.updateOne(
        { sessionId },
        { title, updatedAt: new Date() }
      )

      return result.modifiedCount > 0

    } catch (error) {
      console.error('❌ 更新会话标题失败:', error)
      return false
    }
  }

  /**
   * 更新会话设置
   */
  static async updateSessionSettings(
    sessionId: string,
    settings: Partial<IChatSession['settings']>
  ): Promise<boolean> {
    await ensureDbConnection()

    try {
      const result = await ChatSession.updateOne(
        { sessionId },
        { 
          $set: { 
            'settings': settings,
            updatedAt: new Date()
          }
        }
      )

      return result.modifiedCount > 0

    } catch (error) {
      console.error('❌ 更新会话设置失败:', error)
      return false
    }
  }

  /**
   * 归档会话
   */
  static async archiveSession(sessionId: string): Promise<boolean> {
    await ensureDbConnection()

    try {
      const session = await ChatSession.findOne({ sessionId })
      if (!session) return false

      await session.archive()
      console.log('✅ 会话已归档:', sessionId)
      return true

    } catch (error) {
      console.error('❌ 归档会话失败:', error)
      return false
    }
  }

  /**
   * 恢复会话
   */
  static async restoreSession(sessionId: string): Promise<boolean> {
    await ensureDbConnection()

    try {
      const session = await ChatSession.findOne({ sessionId })
      if (!session) return false

      await session.restore()
      console.log('✅ 会话已恢复:', sessionId)
      return true

    } catch (error) {
      console.error('❌ 恢复会话失败:', error)
      return false
    }
  }

  /**
   * 删除会话（软删除）
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    await ensureDbConnection()

    try {
      const session = await ChatSession.findOne({ sessionId })
      if (!session) return false

      await session.softDelete()
      console.log('✅ 会话已删除:', sessionId)
      return true

    } catch (error) {
      console.error('❌ 删除会话失败:', error)
      return false
    }
  }

  /**
   * 永久删除会话
   */
  static async permanentDeleteSession(sessionId: string): Promise<boolean> {
    await ensureDbConnection()

    try {
      const result = await ChatSession.deleteOne({ sessionId })
      console.log('✅ 会话已永久删除:', sessionId)
      return result.deletedCount > 0

    } catch (error) {
      console.error('❌ 永久删除会话失败:', error)
      return false
    }
  }

  /**
   * 搜索会话
   */
  static async searchSessions(
    userId: string,
    query: string,
    limit: number = 20
  ): Promise<IChatSession[]> {
    await ensureDbConnection()

    try {
      return await ChatSession
        .find({
          userId,
          status: { $ne: 'deleted' },
          $or: [
            { title: { $regex: query, $options: 'i' } },
            { 'messages.content': { $regex: query, $options: 'i' } },
            { 'settings.tags': { $in: [new RegExp(query, 'i')] } }
          ]
        })
        .sort({ 'metadata.lastActiveTime': -1 })
        .limit(limit)

    } catch (error) {
      console.error('❌ 搜索会话失败:', error)
      return []
    }
  }

  /**
   * 获取用户聊天统计
   */
  static async getUserChatStats(userId: string): Promise<{
    totalSessions: number
    activeSessions: number
    archivedSessions: number
    totalMessages: number
    totalTokens: number
    averageSessionDuration: number
    mostActiveDay: string
    emotionDistribution: Record<string, number>
  }> {
    await ensureDbConnection()

    try {
      const sessions = await ChatSession.find({ userId, status: { $ne: 'deleted' } })

      const stats = {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.status === 'active').length,
        archivedSessions: sessions.filter(s => s.status === 'archived').length,
        totalMessages: sessions.reduce((sum, s) => sum + s.stats.messageCount, 0),
        totalTokens: sessions.reduce((sum, s) => sum + s.stats.totalTokens, 0),
        averageSessionDuration: 0,
        mostActiveDay: '',
        emotionDistribution: {} as Record<string, number>
      }

      // 计算平均会话持续时间
      if (sessions.length > 0) {
        const totalDuration = sessions.reduce((sum, s) => sum + s.metadata.duration, 0)
        stats.averageSessionDuration = Math.round(totalDuration / sessions.length)
      }

      // 统计情绪分布
      const allEmotions = sessions.flatMap(s => s.metadata.emotionTrend)
      allEmotions.forEach(emotion => {
        stats.emotionDistribution[emotion] = (stats.emotionDistribution[emotion] || 0) + 1
      })

      // 找出最活跃的日期
      const dayActivity: Record<string, number> = {}
      sessions.forEach(session => {
        const day = session.createdAt.toISOString().split('T')[0]
        dayActivity[day] = (dayActivity[day] || 0) + 1
      })

      stats.mostActiveDay = Object.entries(dayActivity)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || ''

      return stats

    } catch (error) {
      console.error('❌ 获取用户聊天统计失败:', error)
      return {
        totalSessions: 0,
        activeSessions: 0,
        archivedSessions: 0,
        totalMessages: 0,
        totalTokens: 0,
        averageSessionDuration: 0,
        mostActiveDay: '',
        emotionDistribution: {}
      }
    }
  }

  /**
   * 清理过期会话
   */
  static async cleanupExpiredSessions(daysOld: number = 30): Promise<number> {
    await ensureDbConnection()

    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysOld)

      const result = await ChatSession.deleteMany({
        status: 'deleted',
        updatedAt: { $lt: cutoffDate }
      })

      console.log(`✅ 清理了 ${result.deletedCount} 个过期会话`)
      return result.deletedCount

    } catch (error) {
      console.error('❌ 清理过期会话失败:', error)
      return 0
    }
  }

  /**
   * 导出用户聊天记录
   */
  static async exportUserChatHistory(userId: string): Promise<any> {
    await ensureDbConnection()

    try {
      const sessions = await ChatSession.find({ 
        userId, 
        status: { $ne: 'deleted' } 
      }).sort({ createdAt: 1 })

      return {
        exportDate: new Date().toISOString(),
        userId,
        totalSessions: sessions.length,
        sessions: sessions.map(session => ({
          sessionId: session.sessionId,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          stats: session.stats,
          metadata: session.metadata,
          settings: session.settings,
          messages: session.messages.map(msg => ({
            id: msg.id,
            type: msg.type,
            content: msg.content,
            timestamp: msg.timestamp,
            metadata: msg.metadata
          }))
        }))
      }

    } catch (error) {
      console.error('❌ 导出聊天记录失败:', error)
      throw error
    }
  }
}

export default ChatHistoryService
