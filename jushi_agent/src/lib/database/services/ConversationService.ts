/**
 * 对话服务层
 */

import { Conversation, IConversation, IMessage, EmotionAnalysis, TaskData } from '../models/Conversation'
import { UserService } from './UserService'
import { ensureDbConnection } from '../connection'

export class ConversationService {
  /**
   * 创建新对话
   */
  static async createConversation(
    userId: string, 
    title: string,
    type: 'general' | 'task_planning' | 'emotion_support' | 'learning' | 'mixed' = 'general'
  ): Promise<IConversation> {
    await ensureDbConnection()

    try {
      const conversation = new Conversation({
        userId,
        title: title || '新对话',
        messages: [],
        metadata: {
          totalMessages: 0,
          emotionTrend: [],
          hasTaskPlanning: false,
          taskCount: 0,
          completedTaskCount: 0,
          categories: [],
          lastActivity: new Date()
        },
        status: 'active',
        type,
        tags: []
      })

      await conversation.save()

      // 更新用户统计
      await UserService.updateUserStats(userId, { messageCount: 0 })

      console.log('✅ 新对话已创建:', conversation._id)
      return conversation

    } catch (error) {
      console.error('❌ 创建对话失败:', error)
      throw new Error('创建对话失败')
    }
  }

  /**
   * 添加消息到对话
   */
  static async addMessage(
    conversationId: string,
    messageData: {
      role: 'user' | 'assistant'
      content: string
      emotionAnalysis?: EmotionAnalysis
      taskData?: TaskData
      metadata?: any
    }
  ): Promise<IConversation> {
    await ensureDbConnection()

    try {
      const conversation = await Conversation.findById(conversationId)
      if (!conversation) {
        throw new Error('对话不存在')
      }

      // 添加消息
      conversation.addMessage(messageData)
      await conversation.save()

      // 更新用户统计
      const updateStats: any = { messageCount: 1 }
      
      if (messageData.emotionAnalysis) {
        updateStats.emotionScore = messageData.emotionAnalysis.score
        updateStats.emotionTags = messageData.emotionAnalysis.tags
      }

      if (messageData.taskData?.hasTasks) {
        updateStats.plannedTasks = messageData.taskData.tasks.length
      }

      await UserService.updateUserStats(conversation.userId, updateStats)

      console.log('✅ 消息已添加到对话:', conversationId)
      return conversation

    } catch (error) {
      console.error('❌ 添加消息失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的对话列表
   */
  static async getUserConversations(
    userId: string,
    options: {
      page?: number
      limit?: number
      status?: 'active' | 'archived' | 'deleted'
      type?: string
    } = {}
  ): Promise<{
    conversations: IConversation[]
    total: number
    page: number
    totalPages: number
  }> {
    await ensureDbConnection()

    try {
      const { page = 1, limit = 20, status = 'active', type } = options
      const skip = (page - 1) * limit

      const query: any = { userId, status }
      if (type) query.type = type

      const [conversations, total] = await Promise.all([
        Conversation.find(query)
          .sort({ 'metadata.lastActivity': -1 })
          .skip(skip)
          .limit(limit)
          .select('title metadata status type tags createdAt updatedAt'),
        Conversation.countDocuments(query)
      ])

      return {
        conversations,
        total,
        page,
        totalPages: Math.ceil(total / limit)
      }

    } catch (error) {
      console.error('❌ 获取用户对话失败:', error)
      throw error
    }
  }

  /**
   * 获取对话详情
   */
  static async getConversationById(
    conversationId: string,
    userId?: string
  ): Promise<IConversation | null> {
    await ensureDbConnection()

    try {
      const query: any = { _id: conversationId, status: { $ne: 'deleted' } }
      if (userId) query.userId = userId

      const conversation = await Conversation.findOne(query)
      return conversation

    } catch (error) {
      console.error('❌ 获取对话详情失败:', error)
      throw error
    }
  }

  /**
   * 搜索对话
   */
  static async searchConversations(
    userId: string,
    query: string,
    options: {
      page?: number
      limit?: number
    } = {}
  ): Promise<{
    conversations: IConversation[]
    total: number
  }> {
    await ensureDbConnection()

    try {
      const { page = 1, limit = 20 } = options
      const skip = (page - 1) * limit

      const conversations = await Conversation.find({
        userId,
        status: 'active',
        $text: { $search: query }
      })
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limit)
      .select('title metadata createdAt')

      const total = await Conversation.countDocuments({
        userId,
        status: 'active',
        $text: { $search: query }
      })

      return { conversations, total }

    } catch (error) {
      console.error('❌ 搜索对话失败:', error)
      throw error
    }
  }

  /**
   * 更新对话标题
   */
  static async updateConversationTitle(
    conversationId: string,
    title: string,
    userId?: string
  ): Promise<IConversation | null> {
    await ensureDbConnection()

    try {
      const query: any = { _id: conversationId }
      if (userId) query.userId = userId

      const conversation = await Conversation.findOneAndUpdate(
        query,
        { title, 'metadata.lastActivity': new Date() },
        { new: true }
      )

      if (conversation) {
        console.log('✅ 对话标题已更新:', conversationId)
      }

      return conversation

    } catch (error) {
      console.error('❌ 更新对话标题失败:', error)
      throw error
    }
  }

  /**
   * 归档对话
   */
  static async archiveConversation(
    conversationId: string,
    userId?: string
  ): Promise<boolean> {
    await ensureDbConnection()

    try {
      const query: any = { _id: conversationId }
      if (userId) query.userId = userId

      const result = await Conversation.updateOne(
        query,
        { status: 'archived', 'metadata.lastActivity': new Date() }
      )

      if (result.modifiedCount > 0) {
        console.log('✅ 对话已归档:', conversationId)
        return true
      }

      return false

    } catch (error) {
      console.error('❌ 归档对话失败:', error)
      throw error
    }
  }

  /**
   * 删除对话（软删除）
   */
  static async deleteConversation(
    conversationId: string,
    userId?: string
  ): Promise<boolean> {
    await ensureDbConnection()

    try {
      const query: any = { _id: conversationId }
      if (userId) query.userId = userId

      const result = await Conversation.updateOne(
        query,
        { status: 'deleted', 'metadata.lastActivity': new Date() }
      )

      if (result.modifiedCount > 0) {
        console.log('✅ 对话已删除:', conversationId)
        return true
      }

      return false

    } catch (error) {
      console.error('❌ 删除对话失败:', error)
      throw error
    }
  }

  /**
   * 更新任务状态
   */
  static async updateTaskStatus(
    conversationId: string,
    taskId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled',
    userId?: string
  ): Promise<boolean> {
    await ensureDbConnection()

    try {
      const query: any = { _id: conversationId }
      if (userId) query.userId = userId

      const conversation = await Conversation.findOne(query)
      if (!conversation) {
        return false
      }

      await conversation.updateTaskStatus(taskId, status)

      // 如果任务完成，更新用户统计
      if (status === 'completed') {
        await UserService.updateUserStats(conversation.userId, { 
          completedTasks: 1 
        })
      }

      console.log('✅ 任务状态已更新:', taskId, status)
      return true

    } catch (error) {
      console.error('❌ 更新任务状态失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的情绪分析统计
   */
  static async getEmotionAnalytics(
    userId: string,
    days: number = 30
  ): Promise<any> {
    await ensureDbConnection()

    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)

      const analytics = await Conversation.aggregate([
        {
          $match: {
            userId,
            'metadata.lastActivity': { $gte: startDate },
            status: 'active'
          }
        },
        {
          $unwind: '$messages'
        },
        {
          $match: {
            'messages.role': 'user',
            'messages.emotionAnalysis.score': { $exists: true }
          }
        },
        {
          $group: {
            _id: {
              date: { 
                $dateToString: { 
                  format: '%Y-%m-%d', 
                  date: '$messages.timestamp' 
                } 
              }
            },
            avgScore: { $avg: '$messages.emotionAnalysis.score' },
            messageCount: { $sum: 1 },
            tags: { $push: '$messages.emotionAnalysis.tags' }
          }
        },
        {
          $sort: { '_id.date': 1 }
        }
      ])

      return analytics

    } catch (error) {
      console.error('❌ 获取情绪分析统计失败:', error)
      throw error
    }
  }

  /**
   * 获取用户的任务统计
   */
  static async getTaskAnalytics(userId: string): Promise<any> {
    await ensureDbConnection()

    try {
      const analytics = await Conversation.aggregate([
        {
          $match: {
            userId,
            status: 'active',
            'metadata.hasTaskPlanning': true
          }
        },
        {
          $unwind: '$messages'
        },
        {
          $match: {
            'messages.taskData.hasTasks': true
          }
        },
        {
          $unwind: '$messages.taskData.tasks'
        },
        {
          $group: {
            _id: '$messages.taskData.tasks.status',
            count: { $sum: 1 },
            tasks: { $push: '$messages.taskData.tasks' }
          }
        }
      ])

      return analytics

    } catch (error) {
      console.error('❌ 获取任务统计失败:', error)
      throw error
    }
  }
}

export default ConversationService
