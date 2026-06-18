import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
  return proxyWithAuth(request, '/agent/status', {
    method: 'GET',
    successMessage: '获取 Agent 状态成功',
    errorMessage: '获取 Agent 状态失败',
    errorCode: 'AGENT_STATUS_ERROR',
    cache: 'no-store',
  })
}
