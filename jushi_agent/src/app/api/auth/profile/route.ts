/**
 * 用户资料管理API
 * 现在将请求转发到后端Python服务
 */

import { NextRequest } from 'next/server'
import { createErrorResponse, proxyWithAuth } from '@/lib/api/proxy'

/**
 * 获取用户资料
 * GET /api/auth/profile
 */
export async function GET(request: NextRequest) {
  return proxyWithAuth(request, '/auth/profile', {
    method: 'GET',
    successMessage: '获取用户资料成功',
    errorMessage: '获取用户资料失败',
    errorCode: 'FETCH_PROFILE_ERROR',
  })
}

/**
 * 更新用户资料
 * PUT /api/auth/profile
 */
export async function PUT(request: NextRequest) {
  const body = await request.json()

  if (!body.profile) {
    return createErrorResponse('缺少资料数据', 'VALIDATION_ERROR', 400)
  }

  return proxyWithAuth(request, '/auth/profile', {
    method: 'PUT',
    body,
    successMessage: '更新用户资料成功',
    errorMessage: '更新用户资料失败',
    errorCode: 'UPDATE_PROFILE_ERROR',
  })
}
