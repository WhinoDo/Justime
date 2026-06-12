/**
 * NotebookLM 管理 BFF 代理路由
 */

import { NextRequest } from 'next/server'
import { createErrorResponse, proxyWithAuth } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
  return proxyWithAuth(request, '/admin/notebooklm/status', {
    method: 'GET',
    successMessage: '获取 NotebookLM 状态成功',
    errorMessage: '获取 NotebookLM 状态失败',
    errorCode: 'NOTEBOOKLM_STATUS_ERROR',
    cache: 'no-store',
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return proxyWithAuth(request, '/admin/notebooklm/auth', {
      method: 'POST',
      body,
      successMessage: '配置 NotebookLM 凭证成功',
      errorMessage: '配置 NotebookLM 凭证失败',
      errorCode: 'NOTEBOOKLM_AUTH_ERROR',
    })
  } catch (error) {
    return createErrorResponse('无效的请求体', 'VALIDATION_ERROR', 400)
  }
}
