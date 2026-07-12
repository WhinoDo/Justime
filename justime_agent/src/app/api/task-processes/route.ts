import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy'

const TASK_PROCESSES_ENDPOINT = '/task-processes'

export async function GET(request: NextRequest) {
  return proxyToBackend(request, TASK_PROCESSES_ENDPOINT)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    return proxyToBackend(request, TASK_PROCESSES_ENDPOINT, { method: 'POST', body })
  } catch {
    return proxyToBackend(request, TASK_PROCESSES_ENDPOINT, { method: 'POST' })
  }
}
