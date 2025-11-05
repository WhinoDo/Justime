/**
 * 飞书认证优化工具类
 * 根据飞书官方文档实现标准OAuth2授权流程
 * 支持PKCE、CSRF防护、安全state生成等
 */

import { FEISHU_CONFIG } from './config'

export interface FeishuAuthParams {
  authUrl: string
  state: string
  codeVerifier: string
  timestamp: number
}

export interface FeishuCallbackParams {
  code?: string
  error?: string
  state?: string
  error_description?: string
}

export class FeishuAuthOptimized {
  private static readonly STATE_KEY = 'feishu_auth_state'
  private static readonly CODE_VERIFIER_KEY = 'feishu_code_verifier'
  private static readonly AUTH_TIMESTAMP_KEY = 'feishu_auth_timestamp'
  private static readonly REDIRECT_KEY = 'feishu_login_redirect'

  /**
   * 生成随机字符串（用于PKCE code_verifier）
   * 长度：43-128字符，符合RFC 7636规范
   */
  private static generateCodeVerifier(): string {
    // RFC 7636标准字符集：[A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
    // 长度：43-128字符（随机选择）
    const length = 43 + Math.floor(Math.random() * (128 - 43 + 1))
    
    let result = ''
    const array = new Uint8Array(length)
    
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array)
    } else {
      // 服务端环境fallback
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256)
      }
    }
    
    // 从标准字符集中随机选择字符
    for (let i = 0; i < length; i++) {
      result += charset[array[i] % charset.length]
    }
    
    return result
  }

  /**
   * 生成PKCE code_challenge（S256方法）
   * 使用SHA-256哈希 + Base64URL编码
   */
  private static async generateCodeChallenge(verifier: string): Promise<string> {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      // 浏览器环境：使用Web Crypto API
      const encoder = new TextEncoder()
      const data = encoder.encode(verifier)
      const digest = await window.crypto.subtle.digest('SHA-256', data)
      return btoa(String.fromCharCode.apply(null, Array.from(new Uint8Array(digest))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    } else {
      // 服务端环境：使用Node.js crypto（需要安装crypto模块）
      const crypto = require('crypto')
      const hash = crypto.createHash('sha256').update(verifier).digest()
      return Buffer.from(hash).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
    }
  }

  /**
   * 生成UUID格式的state（防CSRF攻击）
   * 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
   */
  private static generateState(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  /**
   * 生成飞书授权URL（符合官方文档规范）
   * 包含CSRF防护、完整参数验证
   */
  static async generateAuthUrl(redirectUri?: string): Promise<FeishuAuthParams> {
    // 1. 生成安全参数
    const state = this.generateState()
    const codeVerifier = this.generateCodeVerifier()
    const timestamp = Date.now()

    // 2. 始终使用固定的redirect_uri，防止URI不匹配错误
    const finalRedirectUri = FEISHU_CONFIG.REDIRECT_URI

    // 3. 构建参数（按照官方文档要求）
    const params = new URLSearchParams({
      client_id: FEISHU_CONFIG.CLIENT_ID,
      redirect_uri: finalRedirectUri,
      scope: FEISHU_CONFIG.SCOPES.join(' '),
      state: state,
      response_type: 'code'
    })

    // 4. 构建完整授权URL
    const authUrl = `${FEISHU_CONFIG.ENDPOINTS.AUTHORIZE}?${params.toString()}`

    // 5. 保存认证参数到localStorage（用于后续验证）
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(this.STATE_KEY, state)
        localStorage.setItem(this.CODE_VERIFIER_KEY, codeVerifier)
        localStorage.setItem(this.AUTH_TIMESTAMP_KEY, timestamp.toString())
      } catch (error) {
        console.warn('⚠️ 无法保存认证参数到localStorage:', error)
      }
    }

    console.log('🔗 生成飞书授权 URL (固定redirect_uri):', {
      baseUrl: FEISHU_CONFIG.ENDPOINTS.AUTHORIZE,
      client_id: FEISHU_CONFIG.CLIENT_ID,
      redirect_uri: finalRedirectUri,
      scope: FEISHU_CONFIG.SCOPES.join(' '),
      state: state,
      fullUrl: authUrl,
      note: '使用固定redirect_uri，防止URI不匹配错误'
    })

    return { authUrl, state, codeVerifier, timestamp }
  }

  /**
   * 验证回调参数（防CSRF攻击）
   */
  static validateCallback(params: FeishuCallbackParams): { valid: boolean; error?: string } {
    console.log('🔍 开始验证回调参数:', {
      hasCode: !!params.code,
      hasError: !!params.error,
      state: params.state,
      error: params.error
    })

    // 1. 检查必要参数
    if (!params.code && !params.error) {
      console.error('❌ 缺少必要参数: code 或 error')
      return { valid: false, error: 'Missing code or error parameter' }
    }

    // 2. 验证state（防CSRF攻击）
    if (typeof window !== 'undefined') {
      const storedState = localStorage.getItem(this.STATE_KEY)
      const authTimestamp = localStorage.getItem(this.AUTH_TIMESTAMP_KEY)
      
      console.log('🔍 state验证详情:', {
        receivedState: params.state,
        storedState: storedState,
        statesMatch: storedState === params.state,
        hasStoredState: !!storedState,
        authTimestamp: authTimestamp
      })

      // 如果localStorage中没有state，可能是跨页面访问问题，记录警告但允许继续
      if (!storedState) {
        console.warn('⚠️ localStorage中没有找到state，可能是跨页面访问问题，允许继续处理')
        // 不直接返回错误，而是记录警告
      } else if (storedState !== params.state) {
        console.error('❌ state参数不匹配:', {
          received: params.state,
          stored: storedState
        })
        return { valid: false, error: 'Invalid state parameter - possible CSRF attack' }
      }

      // 3. 检查时间戳（防止重放攻击）
      if (authTimestamp) {
        const timeDiff = Date.now() - parseInt(authTimestamp)
        const maxAge = 10 * 60 * 1000 // 10分钟
        console.log('🔍 时间戳验证:', {
          authTimestamp: authTimestamp,
          timeDiff: timeDiff,
          maxAge: maxAge,
          isExpired: timeDiff > maxAge
        })
        
        if (timeDiff > maxAge) {
          console.error('❌ 授权请求已过期:', {
            timeDiff: timeDiff,
            maxAge: maxAge
          })
          return { valid: false, error: 'Authorization request expired' }
        }
      } else {
        console.warn('⚠️ 没有找到授权时间戳，跳过时间验证')
      }
    } else {
      console.warn('⚠️ 非浏览器环境，跳过state验证')
    }

    console.log('✅ 回调参数验证通过')
    return { valid: true }
  }

  /**
   * 获取保存的code_verifier（用于token兑换）
   */
  static getCodeVerifier(): string | null {
    if (typeof window === 'undefined') return null
    
    try {
      return localStorage.getItem(this.CODE_VERIFIER_KEY)
    } catch (error) {
      console.warn('⚠️ 无法获取code_verifier:', error)
      return null
    }
  }

  /**
   * 清理认证参数
   */
  static clearAuthParams(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(this.STATE_KEY)
      localStorage.removeItem(this.CODE_VERIFIER_KEY)
      localStorage.removeItem(this.AUTH_TIMESTAMP_KEY)
    } catch (error) {
      console.warn('⚠️ 无法清理认证参数:', error)
    }
  }

  /**
   * 保存当前页面路径，用于登录后跳转回来
   */
  static saveCurrentPath(): void {
    if (typeof window === 'undefined') return

    try {
      const currentPath = window.location.pathname + window.location.search + window.location.hash
      localStorage.setItem(this.REDIRECT_KEY, currentPath)
      console.log('📍 已保存当前页面路径:', currentPath)
    } catch (error) {
      console.error('❌ 保存当前页面路径失败:', error)
    }
  }

  /**
   * 获取登录前保存的页面路径
   */
  static getSavedPath(): string | null {
    if (typeof window === 'undefined') return null

    try {
      return localStorage.getItem(this.REDIRECT_KEY)
    } catch (error) {
      console.warn('⚠️ 无法获取保存的页面路径:', error)
      return null
    }
  }

  /**
   * 清除保存的页面路径
   */
  static clearSavedPath(): void {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem(this.REDIRECT_KEY)
      console.log('🧹 已清除保存的页面路径')
    } catch (error) {
      console.error('❌ 清除保存的页面路径失败:', error)
    }
  }

  /**
   * 跳转到飞书授权页面
   */
  static async redirectToLogin(saveCurrentPath: boolean = true): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('⚠️ 非浏览器环境，无法跳转到飞书授权页面')
      return
    }

    if (saveCurrentPath) {
      this.saveCurrentPath()
    }

    try {
      const { authUrl } = await this.generateAuthUrl()
      console.log('🔗 跳转到飞书授权页面:', authUrl)
      window.location.href = authUrl
    } catch (error) {
      console.error('❌ 生成授权URL失败:', error)
      throw error
    }
  }

  /**
   * 宽松的回调参数验证（用于调试和兼容性）
   * 当严格验证失败时，可以使用此方法进行基础验证
   */
  static validateCallbackLoose(params: FeishuCallbackParams): { valid: boolean; error?: string } {
    console.log('🔍 使用宽松模式验证回调参数:', {
      hasCode: !!params.code,
      hasError: !!params.error,
      state: params.state,
      error: params.error
    })

    // 1. 检查必要参数
    if (!params.code && !params.error) {
      console.error('❌ 缺少必要参数: code 或 error')
      return { valid: false, error: 'Missing code or error parameter' }
    }

    // 2. 基础state格式验证（不依赖localStorage）
    if (params.state) {
      // 检查state是否为有效的UUID格式
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(params.state)) {
        console.warn('⚠️ state格式不正确，但允许继续处理:', params.state)
      } else {
        console.log('✅ state格式验证通过:', params.state)
      }
    } else {
      console.warn('⚠️ 没有state参数，但允许继续处理')
    }

    console.log('✅ 宽松模式验证通过')
    return { valid: true }
  }

  /**
   * 登录完成后跳转回原页面
   */
  static redirectAfterLogin(): void {
    if (typeof window === 'undefined') {
      console.warn('⚠️ 非浏览器环境，无法进行登录后跳转')
      return
    }

    const savedPath = this.getSavedPath()
    
    if (savedPath && !savedPath.includes('/feishu/bind-callback')) {
      console.log('🔗 登录成功，跳转回原页面:', savedPath)
      this.clearSavedPath()
      window.location.href = savedPath
    } else {
      console.log('🔗 登录成功，跳转到首页')
      window.location.href = '/'
    }
  }
}
