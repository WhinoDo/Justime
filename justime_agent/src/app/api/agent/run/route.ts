import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function POST(request: NextRequest) {
  return proxyWithAuth(request, '/agent/run', {
    method: 'POST',
    successMessage: 'Agent 任务执行成功',
    errorMessage: 'Agent 任务执行失败',
    errorCode: 'AGENT_RUN_ERROR',
  })
}
