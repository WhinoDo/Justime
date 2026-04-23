/**
 * 认证服务层
 */

import { User, IUser, UserStatus, UserRole, LoginMethod } from '@/lib/database/models/User'
import { ensureDbConnection } from '@/lib/database/connection'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

export interface RegisterData {
  username?: string
  email: string
  password: string
  displayName?: string
  phone?: string
}

export interface LoginData {
  identifier: string  // 可以是用户名或邮箱
  password: string
  rememberMe?: boolean
}

export interface AuthResult {
  success: boolean
  user?: IUser
  token?: string
  refreshToken?: string
  error?: string
  needsVerification?: boolean
}

export interface TokenPayload {
  userId: string
  username?: string
  email?: string
  role: UserRole
  loginMethod: LoginMethod
  iat?: number
  exp?: number
}

export class AuthService {
  // 安全修复：移除硬编码密钥，强制使用环境变量
  private static readonly JWT_SECRET = process.env.JWT_SECRET || (() => {
    throw new Error('JWT_SECRET environment variable is required. Please set it in your .env file.')
  })()
  private static readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (() => {
    throw new Error('JWT_REFRESH_SECRET environment variable is required. Please set it in your .env file.')
  })()
  private static readonly JWT_EXPIRES_IN = '7d'
  private static readonly JWT_REFRESH_EXPIRES_IN = '30d'

  /**
   * 用户注册
   */
  static async register(data: RegisterData): Promise<AuthResult> {
    await ensureDbConnection()

    try {
      // 检查邮箱是否已存在
      const existingEmailUser = await User.findByEmail(data.email)
      if (existingEmailUser) {
        return {
          success: false,
          error: '该邮箱已被注册'
        }
      }

      // 检查用户名是否已存在（如果提供了用户名）
      if (data.username) {
        const existingUsernameUser = await User.findByUsername(data.username)
        if (existingUsernameUser) {
          return {
            success: false,
            error: '该用户名已被使用'
          }
        }
      }

      // 生成邮箱验证令牌
      const emailVerificationToken = crypto.randomBytes(32).toString('hex')
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期

      // 创建新用户
      const user = new User({
        username: data.username,
        email: data.email,
        password: data.password,
        profile: {
          name: data.displayName || data.username || data.email.split('@')[0],
          displayName: data.displayName,
          email: data.email,
          phone: data.phone
        },
        status: UserStatus.ACTIVE,
        role: UserRole.USER,
        loginMethod: LoginMethod.EMAIL,
        emailVerificationToken,
        emailVerificationExpires,
        isEmailVerified: false,
        isPhoneVerified: false,
        preferences: {
          language: 'zh-CN',
          timezone: 'Asia/Shanghai',
          theme: 'system',
          notifications: {
            email: true,
            push: true
          },
          privacy: {
            profileVisible: true,
            activityVisible: true
          }
        },
        statistics: {
          totalSessions: 0,
          totalMessages: 0,
          totalTokens: 0,
          joinedAt: new Date(),
          lastActiveAt: new Date(),
          avgEmotionScore: 0,
          emotionStats: {
            mostCommonTags: [],
            emotionHistory: []
          }
        },

      })

      await user.save()
      // 仅开发环境输出日志
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ 用户注册成功:', data.email)
      }

      // 生成JWT令牌
      const token = this.generateToken(user)
      const refreshToken = this.generateRefreshToken(user)

      return {
        success: true,
        user,
        token,
        refreshToken,
        needsVerification: true
      }

    } catch (error) {
      console.error('❌ 用户注册失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '注册失败'
      }
    }
  }

  /**
   * 用户登录
   */
  static async login(data: LoginData): Promise<AuthResult> {
    await ensureDbConnection()

    try {
      // 查找用户（支持用户名或邮箱登录）
      let user: IUser | null = null

      if (data.identifier.includes('@')) {
        user = await User.findByEmail(data.identifier)
      } else {
        user = await User.findByUsername(data.identifier)
        // 如果用户名找不到，尝试用邮箱查找
        if (!user) {
          user = await User.findByEmail(data.identifier)
        }
      }

      if (!user) {
        return {
          success: false,
          error: '用户不存在'
        }
      }

      // 检查账户状态
      if (user.status === UserStatus.SUSPENDED) {
        return {
          success: false,
          error: '账户已被暂停'
        }
      }

      if (user.status === UserStatus.DELETED) {
        return {
          success: false,
          error: '账户已被删除'
        }
      }

      // 检查账户是否被锁定
      if (user.isLocked) {
        return {
          success: false,
          error: '账户已被锁定，请稍后再试'
        }
      }

      // 验证密码
      if (!user.password) {
        return {
          success: false,
          error: '该账户未设置密码，请使用其他登录方式'
        }
      }

      const isPasswordValid = await user.comparePassword(data.password)
      if (!isPasswordValid) {
        // 增加登录尝试次数
        await user.incLoginAttempts()
        return {
          success: false,
          error: '密码错误'
        }
      }

      // 重置登录尝试次数
      if (user.loginAttempts > 0) {
        await user.resetLoginAttempts()
      }

      // 更新登录信息
      user.lastLoginAt = new Date()
      user.loginMethod = data.identifier.includes('@') ? LoginMethod.EMAIL : LoginMethod.USERNAME
      await user.updateLastActive()

      // 仅开发环境输出日志
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ 用户登录成功:', data.identifier)
      }

      // 生成JWT令牌
      const tokenExpiry = data.rememberMe ? '30d' : this.JWT_EXPIRES_IN
      const token = this.generateToken(user, tokenExpiry)
      const refreshToken = this.generateRefreshToken(user)

      return {
        success: true,
        user,
        token,
        refreshToken
      }

    } catch (error) {
      console.error('❌ 用户登录失败:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : '登录失败'
      }
    }
  }



  /**
   * 生成JWT令牌
   */
  static generateToken(user: IUser, expiresIn: string = this.JWT_EXPIRES_IN): string {
    const payload: TokenPayload = {
      userId: user._id,
      username: user.username,
      email: user.email || user.profile.email,
      role: user.role,
      loginMethod: user.loginMethod
    }

    return jwt.sign(payload, this.JWT_SECRET, { expiresIn: expiresIn as any })
  }

  /**
   * 生成刷新令牌
   */
  static generateRefreshToken(user: IUser): string {
    const payload = {
      userId: user._id,
      type: 'refresh'
    }

    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN as any
    })
  }

  /**
   * 验证JWT令牌
   */
  static verifyToken(token: string): TokenPayload | null {
    try {
      return jwt.verify(token, this.JWT_SECRET) as TokenPayload
    } catch (error) {
      console.error('❌ JWT令牌验证失败:', error)
      return null
    }
  }

  /**
   * 验证刷新令牌
   */
  static verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const payload = jwt.verify(token, this.JWT_REFRESH_SECRET) as any
      if (payload.type === 'refresh') {
        return { userId: payload.userId }
      }
      return null
    } catch (error) {
      console.error('❌ 刷新令牌验证失败:', error)
      return null
    }
  }

  /**
   * 刷新访问令牌
   */
  static async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    await ensureDbConnection()

    try {
      const payload = this.verifyRefreshToken(refreshToken)
      if (!payload) {
        return {
          success: false,
          error: '无效的刷新令牌'
        }
      }

      const user = await User.findById(payload.userId)
      if (!user || user.status !== UserStatus.ACTIVE) {
        return {
          success: false,
          error: '用户不存在或已被禁用'
        }
      }

      const newToken = this.generateToken(user)
      const newRefreshToken = this.generateRefreshToken(user)

      return {
        success: true,
        user,
        token: newToken,
        refreshToken: newRefreshToken
      }

    } catch (error) {
      console.error('❌ 刷新令牌失败:', error)
      return {
        success: false,
        error: '刷新令牌失败'
      }
    }
  }

  /**
   * 验证邮箱
   */
  static async verifyEmail(token: string): Promise<AuthResult> {
    await ensureDbConnection()

    try {
      const user = await User.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: new Date() }
      })

      if (!user) {
        return {
          success: false,
          error: '验证链接无效或已过期'
        }
      }

      user.isEmailVerified = true
      user.emailVerificationToken = undefined
      user.emailVerificationExpires = undefined
      await user.save()

      // 仅开发环境输出日志
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ 邮箱验证成功:', user.email)
      }

      return {
        success: true,
        user
      }

    } catch (error) {
      console.error('❌ 邮箱验证失败:', error)
      return {
        success: false,
        error: '邮箱验证失败'
      }
    }
  }

  /**
   * 发送密码重置邮件
   */
  static async requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
    await ensureDbConnection()

    try {
      const user = await User.findByEmail(email)
      if (!user) {
        // 为了安全，不透露用户是否存在
        return { success: true }
      }

      const resetToken = crypto.randomBytes(32).toString('hex')
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000) // 1小时后过期

      user.passwordResetToken = resetToken
      user.passwordResetExpires = resetExpires
      await user.save()

      // 仅开发环境输出日志
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ 密码重置令牌已生成:', email)
        console.log('📧 密码重置链接:', `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${resetToken}`)
      }

      return { success: true }

    } catch (error) {
      console.error('❌ 密码重置请求失败:', error)
      return {
        success: false,
        error: '密码重置请求失败'
      }
    }
  }

  /**
   * 重置密码
   */
  static async resetPassword(token: string, newPassword: string): Promise<AuthResult> {
    await ensureDbConnection()

    try {
      const user = await User.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      })

      if (!user) {
        return {
          success: false,
          error: '重置链接无效或已过期'
        }
      }

      user.password = newPassword
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined
      await user.save()

      // 仅开发环境输出日志
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ 密码重置成功:', user.email)
      }

      return {
        success: true,
        user
      }

    } catch (error) {
      console.error('❌ 密码重置失败:', error)
      return {
        success: false,
        error: '密码重置失败'
      }
    }
  }
}

export default AuthService
