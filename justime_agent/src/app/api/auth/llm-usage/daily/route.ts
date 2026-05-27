import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 获取当前用户模型每日 token 使用统计
 * GET /api/auth/llm-usage/daily?days=14&scope=primary
 */
export async function GET(request: NextRequest) {
  return proxyWithAuth(request, '/auth/llm-usage/daily', {
    method: 'GET',
    successMessage: '获取模型 token 统计成功',
    errorMessage: '获取模型 token 统计失败',
    errorCode: 'FETCH_USAGE_ERROR',
    cache: 'no-store',
  })
}
