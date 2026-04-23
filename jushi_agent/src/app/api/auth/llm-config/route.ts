/**
 * LLM配置API路由
 * 获取和更新用户的LLM配置
 */

import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 获取用户的LLM配置
 * GET /api/auth/llm-config
 */
export async function GET(request: NextRequest) {
  return proxyWithAuth(request, '/auth/llm-config', {
    method: 'GET',
    successMessage: '获取配置成功',
    errorMessage: '获取配置失败',
    errorCode: 'FETCH_ERROR',
  })
}

/**
 * 更新用户的LLM配置
 * PUT /api/auth/llm-config
 */
export async function PUT(request: NextRequest) {
  const body = await request.json()
  return proxyWithAuth(request, '/auth/llm-config', {
    method: 'PUT',
    body,
    successMessage: '更新配置成功',
    errorMessage: '更新配置失败',
    errorCode: 'UPDATE_ERROR',
  })
}
