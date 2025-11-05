// 飞书API配置（默认配置，用于未配置自定义应用的用户）
export const FEISHU_CONFIG = {
  // OAuth配置
  CLIENT_ID: process.env.FEISHU_CLIENT_ID || 'cli_a8e96281e53b500c',
  CLIENT_SECRET: process.env.FEISHU_CLIENT_SECRET || 'h4tc71u9Ahho5ceNyjE7QdRNYvP1Hs3q',
  REDIRECT_URI: process.env.FEISHU_REDIRECT_URI || 'http://192.168.1.4:3000/feishu/bind-callback',
  QR_REDIRECT_URI: process.env.FEISHU_QR_REDIRECT_URI || 'http://192.168.1.4:3000/api/feishu/qr-login/callback',
  
  // API端点
  ENDPOINTS: {
    // 授权相关 - 使用官方文档中的授权 URL
    AUTHORIZE: 'https://accounts.feishu.cn/open-apis/authen/v1/authorize',
    TOKEN: 'https://open.feishu.cn/open-apis/authen/v2/oauth/token',                    

    // 用户信息相关
    BATCH_GET_ID: 'https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id',
    USER_INFO: 'https://open.feishu.cn/open-apis/contact/v3/users',
  },
  
  // 权限范围 - 根据应用实际需要的权限
  SCOPES: [
    // 日历相关权限
    'calendar:calendar',
    'calendar:calendar.acl:create',
    'calendar:calendar.acl:delete',
    'calendar:calendar.acl:read',
    'calendar:calendar.event:create',
    'calendar:calendar.free_busy:read',
    'calendar:calendar:create',
    'calendar:calendar:delete',
    'calendar:calendar:read',
    'calendar:calendar:readonly',
    'calendar:calendar:subscribe',
    'calendar:calendar:update',

    // 联系人相关权限
    'contact:contact.base:readonly',
    'contact:user.assign_info:read',
    'contact:user.base:readonly',
    'contact:user.department:readonly',
    'contact:user.department_path:readonly',
    'contact:user.dotted_line_leader_info.read',
    'contact:user.email:readonly',
    'contact:user.employee:readonly',
    'contact:user.employee_id:readonly',
    'contact:user.employee_number:read',
    'contact:user.gender:readonly',
    'contact:user.job_family:readonly',
    'contact:user.job_level:readonly',
    'contact:user.phone:readonly',
    'contact:user.user_geo',
    'directory:employee.base.email:read',

    // 其他权限
    'offline_access',
    'passport:session_mask:readonly'
  ],
  
  // 频率限制
  RATE_LIMITS: {
    BATCH_GET_ID: {
      perMinute: 1000,
      perSecond: 50
    }
  }
}

// 飞书API响应类型定义
export interface FeishuApiResponse<T = any> {
  code: number
  msg: string
  data?: T
}

export interface FeishuUserInfo {
  user_id: string
  mobile?: string
  email?: string
  name?: string
  avatar?: string
}

export interface BatchGetIdRequest {
  emails?: string[]
  mobiles?: string[]
  include_resigned?: boolean
}

export interface BatchGetIdResponse {
  user_list: Array<{
    user_id: string
    mobile?: string
    email?: string
  }>
}

export interface OAuthTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

// 错误类型
export class FeishuApiError extends Error {
  constructor(
    public code: number,
    public message: string,
    public data?: any
  ) {
    super(`Feishu API Error ${code}: ${message}`)
    this.name = 'FeishuApiError'
  }
}
