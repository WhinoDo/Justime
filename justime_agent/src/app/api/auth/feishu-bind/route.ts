/**
 * 飞书账号绑定 BFF 代理路由
 */

import { NextRequest } from 'next/server'
import { createErrorResponse, proxyWithAuth } from '@/lib/api/proxy'

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    return proxyWithAuth(request, '/auth/feishu-bind', {
      method: 'PUT',
      body,
      successMessage: body.feishuOpenId ? '绑定飞书账号成功' : '解绑飞书账号成功',
      errorMessage: '飞书绑定操作失败',
      errorCode: 'FEISHU_BIND_ERROR',
    })
  } catch (error) {
    return createErrorResponse('无效的请求体', 'VALIDATION_ERROR', 400)
  }
}
