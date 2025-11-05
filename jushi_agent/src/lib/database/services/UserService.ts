/**
 * 用户服务层
 */

import { User, IUser, UserPreferences } from '../models/User'
import { ensureDbConnection } from '../connection'

export class UserService {
  /**
   * 根据飞书OpenID查找或创建用户
   */
  static async findOrCreateUser(feishuData: {
    openId: string
    userId: string
    name: string
    email?: string
    avatar?: string
    department?: string
    jobTitle?: string
  }): Promise<IUser> {
    await ensureDbConnection()

    try {
      // 先尝试查找现有用户
      let user = await User.findOne({ feishuOpenId: feishuData.openId })

      if (user) {
        // 更新用户信息
        user.profile.name = feishuData.name
        if (feishuData.email) user.profile.email = feishuData.email
        if (feishuData.avatar) user.profile.avatar = feishuData.avatar
        if (feishuData.department) user.profile.department = feishuData.department
        if (feishuData.jobTitle) user.profile.jobTitle = feishuData.jobTitle
        
        user.statistics.lastActiveAt = new Date()
        await user.save()
        
        console.log('✅ 用户信息已更新:', user.profile.name)
        return user
      }

      // 创建新用户
      user = new User({
        feishuOpenId: feishuData.openId,
        feishuUserId: feishuData.userId,
        profile: {
          name: feishuData.name,
          email: feishuData.email,
          avatar: feishuData.avatar,
          department: feishuData.department,
          jobTitle: feishuData.jobTitle
        },
        preferences: {
          theme: 'light',
          language: 'zh-CN',
          aiPersonality: {
            tone: 'encouraging',
            formality: 'casual',
            responseLength: 'medium'
          },
          notifications: {
            email: true,
            feishu: true,
            taskReminders: true
          }
        },
        statistics: {
          totalConversations: 0,
          totalMessages: 0,
          lastActiveAt: new Date(),
          joinedAt: new Date(),
          studyStats: {
            totalStudyTime: 0,
            completedTasks: 0,
            plannedTasks: 0,
            averageTaskCompletion: 0
          },
          emotionStats: {
            weeklyAverage: 5,
            monthlyTrend: [],
            mostCommonTags: []
          }
        },
        feishuIntegration: {
          isActive: false
        },
        status: 'active'
      })

      await user.save()
      console.log('✅ 新用户已创建:', user.profile.name)
      return user

    } catch (error) {
      console.error('❌ 查找或创建用户失败:', error)
      throw new Error('用户操作失败')
    }
  }

  /**
   * 根据飞书OpenID获取用户
   */
  static async getUserByFeishuId(feishuOpenId: string): Promise<IUser | null> {
    await ensureDbConnection()

    try {
      const user = await User.findOne({ 
        feishuOpenId, 
        status: 'active' 
      })
      
      if (user) {
        // 更新最后活跃时间
        user.statistics.lastActiveAt = new Date()
        await user.save()
      }
      
      return user
    } catch (error) {
      console.error('❌ 获取用户失败:', error)
      return null
    }
  }

  /**
   * 更新用户偏好设置
   */
  static async updateUserPreferences(
    userId: string, 
    preferences: Partial<UserPreferences>
  ): Promise<IUser | null> {
    await ensureDbConnection()

    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('用户不存在')
      }

      // 合并偏好设置
      user.preferences = {
        ...user.preferences,
        ...preferences
      }

      await user.save()
      console.log('✅ 用户偏好已更新:', userId)
      return user

    } catch (error) {
      console.error('❌ 更新用户偏好失败:', error)
      throw error
    }
  }

  /**
   * 更新飞书集成信息
   */
  static async updateFeishuIntegration(
    userId: string,
    integrationData: {
      accessToken?: string
      refreshToken?: string
      tokenExpiresAt?: Date
      calendarId?: string
      isActive?: boolean
    }
  ): Promise<IUser | null> {
    await ensureDbConnection()

    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('用户不存在')
      }

      // 更新飞书集成信息
      user.feishuIntegration = {
        ...user.feishuIntegration,
        ...integrationData
      }

      await user.save()
      console.log('✅ 飞书集成信息已更新:', userId)
      return user

    } catch (error) {
      console.error('❌ 更新飞书集成失败:', error)
      throw error
    }
  }

  /**
   * 更新用户统计信息
   */
  static async updateUserStats(
    userId: string,
    stats: {
      messageCount?: number
      emotionScore?: number
      emotionTags?: string[]
      studyTime?: number
      completedTasks?: number
      plannedTasks?: number
    }
  ): Promise<void> {
    await ensureDbConnection()

    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('用户不存在')
      }

      // 更新消息统计
      if (stats.messageCount) {
        user.statistics.totalMessages += stats.messageCount
      }

      // 更新情绪统计
      if (stats.emotionScore !== undefined) {
        user.updateEmotionStats(stats.emotionScore, stats.emotionTags || [])
      }

      // 更新学习统计
      if (stats.studyTime) {
        user.statistics.studyStats.totalStudyTime += stats.studyTime
      }
      if (stats.completedTasks) {
        user.statistics.studyStats.completedTasks += stats.completedTasks
      }
      if (stats.plannedTasks) {
        user.statistics.studyStats.plannedTasks += stats.plannedTasks
      }

      // 计算任务完成率
      if (user.statistics.studyStats.plannedTasks > 0) {
        user.statistics.studyStats.averageTaskCompletion = 
          (user.statistics.studyStats.completedTasks / user.statistics.studyStats.plannedTasks) * 100
      }

      user.statistics.lastActiveAt = new Date()
      await user.save()

    } catch (error) {
      console.error('❌ 更新用户统计失败:', error)
      throw error
    }
  }

  /**
   * 获取用户统计报告
   */
  static async getUserStatsReport(userId: string): Promise<any> {
    await ensureDbConnection()

    try {
      const user = await User.findById(userId)
      if (!user) {
        throw new Error('用户不存在')
      }

      return {
        profile: {
          name: user.profile.name,
          joinedAt: user.statistics.joinedAt,
          lastActiveAt: user.statistics.lastActiveAt
        },
        conversations: {
          total: user.statistics.totalConversations,
          messages: user.statistics.totalMessages
        },
        emotions: {
          averageScore: user.statistics.avgEmotionScore,
          weeklyAverage: user.statistics.emotionStats.weeklyAverage,
          commonTags: user.statistics.emotionStats.mostCommonTags
        },
        learning: {
          totalStudyTime: user.statistics.studyStats.totalStudyTime,
          completedTasks: user.statistics.studyStats.completedTasks,
          plannedTasks: user.statistics.studyStats.plannedTasks,
          completionRate: user.statistics.studyStats.averageTaskCompletion
        },
        feishu: {
          isConnected: user.isFeishuConnected,
          isActive: user.feishuIntegration.isActive
        }
      }

    } catch (error) {
      console.error('❌ 获取用户统计报告失败:', error)
      throw error
    }
  }

  /**
   * 获取活跃用户列表
   */
  static async getActiveUsers(limit = 50): Promise<IUser[]> {
    await ensureDbConnection()

    try {
      return await User.find({ status: 'active' })
        .sort({ 'statistics.lastActiveAt': -1 })
        .limit(limit)
        .select('profile statistics feishuIntegration')

    } catch (error) {
      console.error('❌ 获取活跃用户失败:', error)
      throw error
    }
  }

  /**
   * 删除用户（软删除）
   */
  static async deleteUser(userId: string): Promise<boolean> {
    await ensureDbConnection()

    try {
      const user = await User.findById(userId)
      if (!user) {
        return false
      }

      user.status = 'inactive'
      await user.save()

      console.log('✅ 用户已删除:', userId)
      return true

    } catch (error) {
      console.error('❌ 删除用户失败:', error)
      throw error
    }
  }
}

export default UserService
