/**
 * 用户服务层
 */

import { User, IUser, UserPreferences } from '../models/User'
import { ensureDbConnection } from '../connection'

export class UserService {




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
        .select('profile statistics')

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
