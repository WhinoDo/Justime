import { 
  FEISHU_CONFIG, 
  FeishuApiResponse, 
  FeishuApiError,
  BatchGetIdRequest,
  BatchGetIdResponse,
  OAuthTokenResponse,
  FeishuUserInfo
} from './config'
// 使用Web Crypto API替代Node.js crypto模块

export class FeishuClient {
  private accessToken?: string
  private tokenExpiry?: Date

  constructor(accessToken?: string) {
    this.accessToken = accessToken
  }

  /**
   * 生成OAuth授权URL
   */
  async generateAuthUrl(state?: string): Promise<{
    url: string
    codeVerifier: string
    state: string
  }> {
    // 生成参数
    const codeVerifier = this.generateCodeVerifier()

    // 生成state参数
    const authState = state || this.generateState()

    const params = new URLSearchParams({
      client_id: FEISHU_CONFIG.CLIENT_ID,
      redirect_uri: FEISHU_CONFIG.REDIRECT_URI,
      scope: FEISHU_CONFIG.SCOPES.join(' '),
      state: authState,
      response_type: 'code'
    })

    return {
      url: `${FEISHU_CONFIG.ENDPOINTS.AUTHORIZE}?${params.toString()}`,
      codeVerifier,
      state: authState
    }
  }

  /**
   * 通过授权码获取访问令牌
   */
  async getAccessToken(code: string, codeVerifier: string): Promise<OAuthTokenResponse> {
    const response = await fetch(FEISHU_CONFIG.ENDPOINTS.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: FEISHU_CONFIG.CLIENT_ID,
        client_secret: FEISHU_CONFIG.CLIENT_SECRET,
        code,
        code_verifier: codeVerifier,
        redirect_uri: FEISHU_CONFIG.REDIRECT_URI
      })
    })

    const data = await response.json()
    
    if (!response.ok || data.code !== 0) {
      throw new FeishuApiError(data.code || response.status, data.msg || 'Token exchange failed', data)
    }

    this.accessToken = data.data.access_token
    this.tokenExpiry = new Date(Date.now() + data.data.expires_in * 1000)
    
    return data.data
  }

  /**
   * 通过手机号或邮箱批量获取用户ID
   */
  async batchGetUserId(request: BatchGetIdRequest): Promise<BatchGetIdResponse> {
    if (!this.accessToken) {
      throw new Error('Access token is required')
    }

    // 验证请求参数
    if ((!request.emails || request.emails.length === 0) && 
        (!request.mobiles || request.mobiles.length === 0)) {
      throw new Error('At least one email or mobile is required')
    }

    const url = new URL(FEISHU_CONFIG.ENDPOINTS.BATCH_GET_ID)
    url.searchParams.set('user_id_type', 'user_id')

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`
      },
      body: JSON.stringify({
        emails: request.emails || [],
        mobiles: request.mobiles || [],
        include_resigned: request.include_resigned ?? true
      })
    })

    const data: FeishuApiResponse<BatchGetIdResponse> = await response.json()
    
    if (!response.ok || data.code !== 0) {
      throw new FeishuApiError(data.code || response.status, data.msg || 'Batch get user ID failed', data)
    }

    return data.data!
  }

  /**
   * 获取用户详细信息
   */
  async getUserInfo(userId: string): Promise<FeishuUserInfo> {
    if (!this.accessToken) {
      throw new Error('Access token is required')
    }

    const url = `${FEISHU_CONFIG.ENDPOINTS.USER_INFO}/${userId}`
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    })

    const data: FeishuApiResponse<{ user: FeishuUserInfo }> = await response.json()
    
    if (!response.ok || data.code !== 0) {
      throw new FeishuApiError(data.code || response.status, data.msg || 'Get user info failed', data)
    }

    return data.data!.user
  }

  /**
   * 获取应用访问令牌
   */
  async getAppAccessToken(): Promise<string> {
    const response = await fetch(`${FEISHU_CONFIG.ENDPOINTS.TOKEN.replace('/oidc/access_token', '/app_access_token/internal')}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: FEISHU_CONFIG.CLIENT_ID,
        app_secret: FEISHU_CONFIG.CLIENT_SECRET
      })
    })

    const data = await response.json()

    if (!response.ok || data.code !== 0) {
      throw new FeishuApiError(data.code || response.status, data.msg || 'Failed to get app access token', data)
    }

    return data.tenant_access_token
  }

  /**
   * 使用授权码交换用户访问令牌
   */
  async exchangeCodeForToken(code: string, appAccessToken: string): Promise<{
    access_token: string
    refresh_token: string
    token_type: string
    expires_in: number
  }> {
    const response = await fetch(FEISHU_CONFIG.ENDPOINTS.TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${appAccessToken}`
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code
      })
    })

    const data = await response.json()

    if (!response.ok || data.code !== 0) {
      throw new FeishuApiError(data.code || response.status, data.msg || 'Failed to exchange code for token', data)
    }

    return data.data
  }

  /**
   * 通过访问令牌获取用户信息
   */
  async getUserInfoByToken(accessToken: string, tokenType: string = 'Bearer'): Promise<{
    name: string
    open_id: string
    user_id: string
    tenant_key: string
    avatar_url: string
    email?: string
    mobile?: string
  }> {
    const response = await fetch(`${FEISHU_CONFIG.ENDPOINTS.USER_INFO.replace('/contact/v3/users', '/authen/v1/user_info')}`, {
      method: 'GET',
      headers: {
        'Authorization': `${tokenType} ${accessToken}`
      }
    })

    const data = await response.json()

    if (!response.ok || data.code !== 0) {
      throw new FeishuApiError(data.code || response.status, data.msg || 'Failed to get user info', data)
    }

    return data.data
  }

  /**
   * 检查访问令牌是否有效
   */
  isTokenValid(): boolean {
    return !!(this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date())
  }

  // 私有方法
  private generateCodeVerifier(): string {
    // 生成32字节的随机数据并转换为base64url
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return this.base64UrlEncode(array)
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    // 使用SHA256哈希并转换为base64url
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const hash = await crypto.subtle.digest('SHA-256', data)
    return this.base64UrlEncode(new Uint8Array(hash))
  }

  private generateState(): string {
    // 生成16字节的随机数据并转换为hex
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  private base64UrlEncode(array: Uint8Array): string {
    // 将Uint8Array转换为base64url格式
    const base64 = btoa(String.fromCharCode.apply(null, Array.from(array)))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }
}
