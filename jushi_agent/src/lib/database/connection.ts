/**
 * MongoDB数据库连接管理
 */

import mongoose from 'mongoose'

interface ConnectionState {
  isConnected: boolean
  isConnecting: boolean
  error?: string
}

class DatabaseConnection {
  private static instance: DatabaseConnection
  private state: ConnectionState = {
    isConnected: false,
    isConnecting: false
  }

  private constructor() {}

  static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection()
    }
    return DatabaseConnection.instance
  }

  /**
   * 连接到MongoDB数据库
   */
  async connect(): Promise<void> {
    if (this.state.isConnected) {
      console.log('📊 数据库已连接')
      return
    }

    if (this.state.isConnecting) {
      console.log('📊 数据库连接中...')
      return
    }

    try {
      this.state.isConnecting = true
      this.state.error = undefined

      const mongoUri = process.env.MONGODB_URI
      if (!mongoUri) {
        const errorMsg = 'MONGODB_URI 环境变量未设置。请在 .env.local 文件中添加: MONGODB_URI=mongodb://localhost:27017/jushi-agent'
        console.error('❌', errorMsg)
        throw new Error(errorMsg)
      }

      console.log('📊 开始连接MongoDB数据库...')

      await mongoose.connect(mongoUri, {
        // 连接选项
        maxPoolSize: 10, // 连接池最大连接数
        serverSelectionTimeoutMS: 5000, // 服务器选择超时
        socketTimeoutMS: 45000, // Socket超时
        bufferCommands: false // 禁用mongoose缓冲
      })

      this.state.isConnected = true
      this.state.isConnecting = false

      console.log('✅ MongoDB数据库连接成功')

      // 监听连接事件
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB连接错误:', error)
        this.state.error = error.message
      })

      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB连接断开')
        this.state.isConnected = false
      })

      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB重新连接成功')
        this.state.isConnected = true
        this.state.error = undefined
      })

    } catch (error) {
      this.state.isConnecting = false
      this.state.error = error instanceof Error ? error.message : '未知错误'
      console.error('❌ MongoDB连接失败:', error)
      throw error
    }
  }

  /**
   * 断开数据库连接
   */
  async disconnect(): Promise<void> {
    if (!this.state.isConnected) {
      return
    }

    try {
      await mongoose.disconnect()
      this.state.isConnected = false
      console.log('📊 MongoDB数据库连接已断开')
    } catch (error) {
      console.error('❌ 断开MongoDB连接失败:', error)
      throw error
    }
  }

  /**
   * 获取连接状态
   */
  getState(): ConnectionState {
    return { ...this.state }
  }

  /**
   * 检查连接健康状态
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.state.isConnected) {
        return false
      }

      // 执行简单的ping操作
      await mongoose.connection.db.admin().ping()
      return true
    } catch (error) {
      console.error('❌ 数据库健康检查失败:', error)
      return false
    }
  }
}

// 导出单例实例
export const dbConnection = DatabaseConnection.getInstance()

/**
 * 确保数据库连接的中间件函数
 */
export async function ensureDbConnection(): Promise<void> {
  try {
    await dbConnection.connect()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    console.error('❌ 确保数据库连接失败:', errorMessage)
    
    // 提供更详细的错误信息
    if (errorMessage.includes('MONGODB_URI')) {
      throw new Error('数据库配置错误：MONGODB_URI 环境变量未设置')
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
      throw new Error('数据库连接失败：请确保 MongoDB 服务正在运行')
    } else {
      throw new Error(`数据库连接失败：${errorMessage}`)
    }
  }
}

/**
 * 用于API路由的数据库连接装饰器
 */
export function withDatabase<T extends any[], R>(
  handler: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    await ensureDbConnection()
    return handler(...args)
  }
}

// 在开发环境中，防止热重载时重复连接
if (process.env.NODE_ENV === 'development') {
  // 在全局对象上存储连接状态
  const globalForMongoose = globalThis as unknown as {
    mongoose: {
      conn: typeof mongoose | null
      promise: Promise<typeof mongoose> | null
    }
  }

  if (!globalForMongoose.mongoose) {
    globalForMongoose.mongoose = { conn: null, promise: null }
  }

  if (globalForMongoose.mongoose.conn) {
    console.log('📊 使用现有的MongoDB连接')
  }
}

export default dbConnection
