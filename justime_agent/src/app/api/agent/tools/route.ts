import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
  return proxyWithAuth(request, '/agent/tools', {
    method: 'GET',
    successMessage: '获取工具列表成功',
    errorMessage: '获取工具列表失败',
    errorCode: 'AGENT_TOOLS_ERROR',
    cache: 'no-store',
  })
}
