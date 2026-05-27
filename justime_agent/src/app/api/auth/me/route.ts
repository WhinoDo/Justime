/**
 * 获取当前用户信息API
 * 将请求转发到后端Python服务
 */

import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 获取当前用户信息
 * GET /api/auth/me
 */
export async function GET(request: NextRequest) {
  return proxyWithAuth(request, '/auth/me', {
    method: 'GET',
    successMessage: '获取用户信息成功',
    errorMessage: '获取用户信息失败',
    errorCode: 'FETCH_USER_ERROR',
  })
}
