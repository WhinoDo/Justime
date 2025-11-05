/**
 * 飞书 Token 管理器
 * 用于管理飞书登录后的 access_token 等信息，支持日程管理等功能
 */

export interface FeishuTokenInfo {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn?: number
  expiresAt?: number // 过期时间戳
}

export interface FeishuUserInfo {
  name: string
  openId: string
  userId: string
  tenantKey: string
  avatarUrl: string
  email?: string
  mobile?: string
}

export interface FeishuLoginSession {
  tokenInfo: FeishuTokenInfo
  userInfo: FeishuUserInfo
  loginTimestamp: number
  lastRefreshTimestamp?: number
}

export class FeishuTokenManager {
  private static readonly TOKEN_KEY = 'feishu_token_info'
  private static readonly USER_KEY = 'feishu_user_info'
  private static readonly SESSION_KEY = 'feishu_login_session'
  private static readonly TIMESTAMP_KEY = 'feishu_login_timestamp'

  /**
   * 保存完整的登录会话信息
   */
  static saveLoginSession(tokenInfo: FeishuTokenInfo, userInfo: FeishuUserInfo): boolean {
    // 检查是否在浏览器环境
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.warn('⚠️ 非浏览器环境，无法保存到 localStorage')
      return false
    }

    const now = Date.now()

    // 计算 token 过期时间
    const expiresAt = tokenInfo.expiresIn ? now + (tokenInfo.expiresIn * 1000) : undefined

    const session: FeishuLoginSession = {
      tokenInfo: {
        ...tokenInfo,
        expiresAt
      },
      userInfo,
      loginTimestamp: now
    }

    // 保存到 localStorage
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session))
    localStorage.setItem(this.TOKEN_KEY, JSON.stringify(session.tokenInfo))
    localStorage.setItem(this.USER_KEY, JSON.stringify(session.userInfo))
    localStorage.setItem(this.TIMESTAMP_KEY, now.toString())

    // 设置登录状态标记，用于其他页面快速检查
    localStorage.setItem('feishu_login_status', 'success')
    localStorage.setItem('feishu_login_complete', 'true')

    // 触发多个存储事件，确保所有监听器都能收到通知
    try {
      // 触发登录状态变化事件
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'feishu_login_status',
        newValue: 'success',
        storageArea: localStorage
      }))

      // 触发登录完成事件
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'feishu_login_complete',
        newValue: 'true',
        storageArea: localStorage
      }))

      // 触发自定义事件，用于实时更新
      window.dispatchEvent(new CustomEvent('feishu-login-success', {
        detail: { tokenInfo, userInfo, timestamp: now }
      }))
    } catch (e) {
      console.log('无法触发存储事件:', e)
    }

    console.log('✅ 飞书登录会话已保存:', {
      user: userInfo.name,
      openId: userInfo.open_id,
      userId: userInfo.user_id,
      tokenType: tokenInfo.tokenType,
      hasAccessToken: !!tokenInfo.accessToken,
      expiresAt: expiresAt ? new Date(expiresAt).toLocaleString() : '未知'
    })

    return true
  }

  /**
   * 获取完整的登录会话信息
   */
  static getLoginSession(): FeishuLoginSession | null {
    // 检查是否在浏览器环境
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.warn('⚠️ 非浏览器环境，无法访问 localStorage')
      return null
    }

    try {
      const sessionStr = localStorage.getItem(this.SESSION_KEY)
      if (!sessionStr) return null

      const session: FeishuLoginSession = JSON.parse(sessionStr)

      // 验证会话是否有效（兼容 open_id 和 openId）
      const hasValidOpenId = session.userInfo?.open_id || session.userInfo?.openId
      if (!session.tokenInfo?.accessToken || !hasValidOpenId) {
        console.warn('⚠️ 飞书会话信息不完整，清理无效数据', {
          hasAccessToken: !!session.tokenInfo?.accessToken,
          hasOpenId: !!hasValidOpenId,
          userInfoKeys: session.userInfo ? Object.keys(session.userInfo) : [],
          tokenInfoKeys: session.tokenInfo ? Object.keys(session.tokenInfo) : []
        })
        this.clearLoginSession()
        return null
      }

      return session
    } catch (error) {
      console.error('❌ 解析飞书会话信息失败:', error)
      this.clearLoginSession()
      return null
    }
  }

  /**
   * 获取访问令牌信息
   */
  static getTokenInfo(): FeishuTokenInfo | null {
    const session = this.getLoginSession()
    return session?.tokenInfo || null
  }

  /**
   * 获取用户信息
   */
  static getUserInfo(): FeishuUserInfo | null {
    const session = this.getLoginSession()
    return session?.userInfo || null
  }

  /**
   * 获取有效的访问令牌（用于API调用）
   */
  static getValidAccessToken(): string | null {
    const tokenInfo = this.getTokenInfo()
    if (!tokenInfo?.accessToken) return null

    // 检查 token 是否过期
    if (tokenInfo.expiresAt && Date.now() >= tokenInfo.expiresAt) {
      console.warn('⚠️ Access token 已过期')
      return null
    }

    return tokenInfo.accessToken
  }

  /**
   * 获取有效的访问令牌（支持自动刷新）
   */
  static async getValidAccessTokenWithRefresh(): Promise<string | null> {
    let tokenInfo = this.getTokenInfo()
    if (!tokenInfo?.accessToken) {
      console.log('❌ 没有访问令牌')
      return null
    }

    console.log('🔍 检查令牌有效性:', {
      hasToken: !!tokenInfo.accessToken,
      expiresAt: tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toISOString() : 'unknown',
      currentTime: new Date().toISOString(),
      isExpired: tokenInfo.expiresAt ? Date.now() >= tokenInfo.expiresAt : false
    })

    // 检查 token 是否过期（提前5分钟刷新）
    const bufferTime = 5 * 60 * 1000 // 5分钟缓冲时间
    if (tokenInfo.expiresAt && Date.now() >= (tokenInfo.expiresAt - bufferTime)) {
      console.warn('⚠️ 访问令牌即将过期或已过期，尝试自动刷新...')

      try {
        const refreshSuccess = await this.refreshAccessToken()
        if (!refreshSuccess) {
          console.error('❌ 令牌刷新失败，清除本地令牌')
          this.clearTokens()
          return null
        }

        // 重新获取刷新后的令牌
        tokenInfo = this.getTokenInfo()
        if (!tokenInfo?.accessToken) {
          console.error('❌ 刷新后仍无法获取访问令牌')
          return null
        }

        console.log('✅ 令牌刷新成功')
      } catch (error) {
        console.error('❌ 令牌刷新过程中发生错误:', error)
        this.clearTokens()
        return null
      }
    }

    return tokenInfo.accessToken
  }

  /**
   * 获取授权头信息（用于API调用）
   */
  static getAuthHeader(): { Authorization: string } | null {
    const tokenInfo = this.getTokenInfo()
    const accessToken = this.getValidAccessToken()
    
    if (!accessToken || !tokenInfo) return null

    return {
      Authorization: `${tokenInfo.tokenType || 'Bearer'} ${accessToken}`
    }
  }

  /**
   * 检查是否已登录
   */
  static isLoggedIn(): boolean {
    // 确保在浏览器环境中运行
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false
    }

    try {
      const session = this.getLoginSession()
      if (!session) {
        console.log('🔍 登录状态检查: 无会话信息')
        return false
      }

      // 检查必要的字段（兼容 open_id 和 openId）
      const hasValidOpenId = session.userInfo?.open_id || session.userInfo?.openId
      if (!session.tokenInfo?.accessToken || !hasValidOpenId) {
        console.log('🔍 登录状态检查: 缺少必要的 token 或用户信息', {
          hasAccessToken: !!session.tokenInfo?.accessToken,
          hasOpenId: !!hasValidOpenId,
          userInfoKeys: session.userInfo ? Object.keys(session.userInfo) : []
        })
        return false
      }

      // 检查登录是否在有效期内（7天）
      const maxAge = 7 * 24 * 60 * 60 * 1000 // 7天
      const isExpired = Date.now() - session.loginTimestamp > maxAge

      if (isExpired) {
        console.warn('⚠️ 飞书登录会话已过期（超过7天）')
        this.clearLoginSession()
        return false
      }

      console.log('✅ 登录状态检查: 用户已登录', {
        user: session.userInfo.name,
        hasToken: !!session.tokenInfo.accessToken,
        loginTime: new Date(session.loginTimestamp).toLocaleString()
      })

      return true
    } catch (error) {
      console.error('❌ 登录状态检查失败:', error)
      return false
    }
  }

  /**
   * 清理登录会话
   */
  static clearLoginSession(): void {
    // 检查是否在浏览器环境
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      console.warn('⚠️ 非浏览器环境，无法清理 localStorage')
      return
    }

    localStorage.removeItem(this.SESSION_KEY)
    localStorage.removeItem(this.TOKEN_KEY)
    localStorage.removeItem(this.USER_KEY)
    localStorage.removeItem(this.TIMESTAMP_KEY)
    localStorage.removeItem('feishu_login_status')
    localStorage.removeItem('feishu_login_complete')
    localStorage.removeItem('feishu_token_info')
    localStorage.removeItem('feishu_user_info')
    localStorage.removeItem('feishu_login_timestamp')

    // 触发存储事件，通知其他页面登录状态变化
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'feishu_login_status',
        newValue: null,
        storageArea: localStorage
      }))
    } catch (e) {
      console.log('无法触发存储事件:', e)
    }

    console.log('🧹 飞书登录会话已清理')
  }

  /**
   * 清除令牌（clearLoginSession 的别名）
   */
  static clearTokens(): void {
    this.clearLoginSession()
  }

  /**
   * 刷新访问令牌
   */
  static async refreshAccessToken(): Promise<boolean> {
    const session = this.getLoginSession()
    if (!session?.tokenInfo?.refreshToken) {
      console.error('❌ 没有 refresh token，无法刷新访问令牌')
      return false
    }

    try {
      console.log('🔄 正在刷新访问令牌...')

      // 注意：刷新令牌功能已移除，需要重新登录
      throw new Error('刷新令牌功能已移除，请重新登录')

      // 更新令牌信息
      const newTokenInfo: FeishuTokenInfo = {
        accessToken: result.data.access_token,
        refreshToken: result.data.refresh_token || session.tokenInfo.refreshToken,
        tokenType: result.data.token_type || 'Bearer',
        expiresIn: result.data.expires_in,
        expiresAt: Date.now() + (result.data.expires_in * 1000)
      }

      // 更新存储的令牌信息
      const updatedSession = {
        ...session,
        tokenInfo: newTokenInfo
      }

      this.saveLoginSession(updatedSession)
      console.log('✅ 访问令牌刷新成功')

      return true
    } catch (error) {
      console.error('❌ 刷新访问令牌失败:', error)
      // 刷新失败时清除会话，强制用户重新登录
      this.clearLoginSession()
      return false
    }
  }

  /**
   * 获取登录状态摘要（用于调试）
   */
  static getLoginSummary(): object {
    const session = this.getLoginSession()
    if (!session) return { status: 'not_logged_in' }

    const tokenInfo = session.tokenInfo
    const userInfo = session.userInfo

    return {
      status: 'logged_in',
      user: {
        name: userInfo.name,
        openId: userInfo.openId,
        tenantKey: userInfo.tenantKey
      },
      token: {
        type: tokenInfo.tokenType,
        hasAccessToken: !!tokenInfo.accessToken,
        hasRefreshToken: !!tokenInfo.refreshToken,
        expiresAt: tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toLocaleString() : '未知',
        isExpired: tokenInfo.expiresAt ? Date.now() >= tokenInfo.expiresAt : false
      },
      session: {
        loginTime: new Date(session.loginTimestamp).toLocaleString(),
        ageInHours: Math.round((Date.now() - session.loginTimestamp) / (1000 * 60 * 60))
      }
    }
  }
}
