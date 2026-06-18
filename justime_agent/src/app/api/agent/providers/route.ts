import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
  return proxyWithAuth(request, '/agent/providers', {
    method: 'GET',
    successMessage: '获取提供者列表成功',
    errorMessage: '获取提供者列表失败',
    errorCode: 'AGENT_PROVIDERS_ERROR',
    cache: 'no-store',
  })
}
