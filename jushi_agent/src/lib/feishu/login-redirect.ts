import { FEISHU_CONFIG } from './config'

/**
 * 飞书登录跳转管理器
 * 统一管理所有登录跳转逻辑，确保始终使用正确的飞书授权页面
 */

export class FeishuLoginRedirect {
  // 存储跳转前页面的 key
  private static readonly REDIRECT_KEY = 'feishu_login_redirect'

  /**
   * 获取完整的飞书授权 URL
   * 根据官方文档构建包含所有必要参数的授权 URL
   * @param returnTo 登录成功后要跳转的页面，通过state参数传递
   */
  static getLoginUrl(returnTo?: string): string {
    // 构造state参数，包含时间戳和returnTo信息
    let state = `success_login_${Date.now()}`
    if (returnTo) {
      // 将returnTo编码到state中
      const stateData = {
        timestamp: Date.now(),
        returnTo: returnTo
      }
      state = `login_${btoa(JSON.stringify(stateData))}`
    }

    // 使用固定的redirect_uri，不包含动态查询参数
    const redirectUri = FEISHU_CONFIG.REDIRECT_URI

    const params = new URLSearchParams({
      client_id: FEISHU_CONFIG.CLIENT_ID,
      redirect_uri: redirectUri,
      scope: FEISHU_CONFIG.SCOPES.join(' '),
      state: state,
      response_type: 'code'
    })

    const authUrl = `${FEISHU_CONFIG.ENDPOINTS.AUTHORIZE}?${params.toString()}`

    console.log('🔗 生成飞书授权 URL (固定redirect_uri):', {
      baseUrl: FEISHU_CONFIG.ENDPOINTS.AUTHORIZE,
      client_id: FEISHU_CONFIG.CLIENT_ID,
      redirect_uri: redirectUri,
      scope: FEISHU_CONFIG.SCOPES.join(' '),
      state: state,
      returnTo: returnTo,
      fullUrl: authUrl
    })

    return authUrl
  }

  /**
   * 从state参数中解析returnTo信息
   * @param state 从飞书回调中收到的state参数
   * @returns 解析出的returnTo路径，如果解析失败则返回null
   */
  static parseReturnToFromState(state: string): string | null {
    try {
      if (!state || !state.startsWith('login_')) {
        return null
      }
      
      const base64Data = state.replace('login_', '')
      const stateData = JSON.parse(atob(base64Data))
      
      return stateData.returnTo || null
    } catch (error) {
      console.warn('⚠️ 解析state中的returnTo失败:', error)
      return null
    }
  }

  /**
   * 获取完整的回调 URL
   */
  static getCallbackUrl(): string {
    return FEISHU_CONFIG.REDIRECT_URI
  }

  /**
   * 保存当前页面路径，用于登录后跳转回来
   */
  static saveCurrentPath(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }

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
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return null
    }

    try {
      const savedPath = localStorage.getItem(this.REDIRECT_KEY)
      console.log('📍 获取保存的页面路径:', savedPath)
      return savedPath
    } catch (error) {
      console.error('❌ 获取保存的页面路径失败:', error)
      return null
    }
  }

  /**
   * 清除保存的页面路径
   */
  static clearSavedPath(): void {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return
    }

    try {
      localStorage.removeItem(this.REDIRECT_KEY)
      console.log('🧹 已清除保存的页面路径')
    } catch (error) {
      console.error('❌ 清除保存的页面路径失败:', error)
    }
  }

  /**
   * 跳转到飞书授权页面（使用优化版本）
   * @param saveCurrentPath 是否保存当前页面路径，默认为 true
   * @param returnTo 登录成功后要跳转的页面，如果不指定则使用保存的路径或默认页面
   */
  static async redirectToLogin(saveCurrentPath: boolean = true, returnTo?: string): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('⚠️ 非浏览器环境，无法跳转到飞书授权页面')
      return
    }

    // 如果指定了returnTo，直接使用；否则如果需要保存当前路径，则使用当前路径
    const targetReturnTo = returnTo || (saveCurrentPath ? window.location.pathname : undefined)

    try {
      // 使用优化的认证工具
      const { FeishuAuthOptimized } = await import('./feishu-auth-optimized')
      
      if (targetReturnTo) {
        // 如果有指定返回地址，传递给优化认证工具
        const authParams = await FeishuAuthOptimized.generateAuthUrl()
        const loginUrl = this.getLoginUrl(targetReturnTo)
        console.log('🔗 使用指定返回地址跳转到飞书授权页面:', { loginUrl, returnTo: targetReturnTo })
        window.location.href = loginUrl
      } else {
        await FeishuAuthOptimized.redirectToLogin(saveCurrentPath)
      }
    } catch (error) {
      console.error('❌ 跳转到飞书授权页面失败:', error)
      
      // 降级到原始方法
      if (saveCurrentPath && !targetReturnTo) {
        this.saveCurrentPath()
      }

      const loginUrl = this.getLoginUrl(targetReturnTo)
      console.log('🔗 使用降级方法跳转到飞书授权页面:', loginUrl)
      window.location.href = loginUrl
    }
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
    
    if (savedPath && !savedPath.includes('/feishu/redirect')) {
      console.log('🔗 登录成功，跳转回原页面:', savedPath)
      this.clearSavedPath()
      window.location.href = savedPath
    } else {
      console.log('🔗 登录成功，跳转到首页')
      window.location.href = '/'
    }
  }

  /**
   * 检查是否需要登录并自动跳转
   * @param showAlert 是否显示提示信息，默认为 true
   */
  static checkAndRedirectIfNeeded(showAlert: boolean = true): boolean {
    if (typeof window === 'undefined') {
      return false
    }

    // 这里可以添加登录状态检查逻辑
    // 暂时返回 false，表示不需要跳转
    return false
  }

  /**
   * 显示登录提示并跳转到飞书授权页面
   * @param message 提示信息
   * @param autoRedirect 是否自动跳转，默认为 true
   */
  static showLoginPrompt(message: string = '请先登录飞书账号', autoRedirect: boolean = true): void {
    if (typeof window === 'undefined') {
      return
    }

    console.log('🔔 显示登录提示:', message)

    if (autoRedirect) {
      // 显示提示后自动跳转
      alert(message)
      this.redirectToLogin()
    } else {
      // 显示确认对话框
      const confirmed = confirm(`${message}\n\n是否现在去登录？`)
      if (confirmed) {
        this.redirectToLogin()
      }
    }
  }

  /**
   * 创建登录按钮的点击处理函数
   */
  static createLoginHandler(saveCurrentPath: boolean = true): () => void {
    return () => {
      this.redirectToLogin(saveCurrentPath)
    }
  }

  /**
   * 获取登录状态检查 URL（用于 iframe 或 AJAX 检查）
   */
  static getLoginCheckUrl(): string {
    if (typeof window === 'undefined') {
      return '/api/feishu/qr-login'
    }
    
    const baseUrl = window.location.origin
    return `${baseUrl}/api/feishu/qr-login`
  }

  /**
   * 在新窗口中打开飞书授权页面
   * @param width 窗口宽度，默认 600
   * @param height 窗口高度，默认 700
   */
  static openLoginWindow(width: number = 600, height: number = 700): Window | null {
    if (typeof window === 'undefined') {
      console.warn('⚠️ 非浏览器环境，无法打开登录窗口')
      return null
    }

    const loginUrl = this.getLoginUrl()
    const left = (window.screen.width - width) / 2
    const top = (window.screen.height - height) / 2

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'resizable=yes',
      'scrollbars=yes',
      'status=yes',
      'menubar=no',
      'toolbar=no',
      'location=no'
    ].join(',')

    console.log('🪟 在新窗口中打开飞书授权页面:', loginUrl)

    try {
      const loginWindow = window.open(loginUrl, 'feishu_login', features)

      if (!loginWindow) {
        console.warn('⚠️ 无法打开登录窗口，可能被浏览器阻止')
        // 如果弹窗被阻止，回退到页面跳转
        this.redirectToLogin()
        return null
      }

      return loginWindow
    } catch (error) {
      console.error('❌ 打开登录窗口失败:', error)
      // 如果出错，回退到页面跳转
      this.redirectToLogin()
      return null
    }
  }

  /**
   * 监听登录窗口关闭事件
   * @param loginWindow 登录窗口对象
   * @param onSuccess 登录成功回调
   * @param onCancel 取消登录回调
   */
  static watchLoginWindow(
    loginWindow: Window,
    onSuccess?: () => void,
    onCancel?: () => void
  ): void {
    if (typeof window === 'undefined') {
      return
    }

    const checkClosed = setInterval(() => {
      if (loginWindow.closed) {
        clearInterval(checkClosed)
        
        // 检查登录是否成功
        // 这里可以通过检查 localStorage 或发送请求来确认
        setTimeout(() => {
          // 简单的登录状态检查
          const hasToken = localStorage.getItem('feishu_session')
          if (hasToken) {
            console.log('✅ 登录窗口关闭，登录成功')
            onSuccess?.()
          } else {
            console.log('❌ 登录窗口关闭，登录取消或失败')
            onCancel?.()
          }
        }, 1000)
      }
    }, 1000)
  }
}
