import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  return proxyWithAuth(request, `/calendar/events/${id}/youtube-summary/jobs`, {
    method: 'POST',
    body: body || {},
    successMessage: '创建 YouTube 解析任务成功',
    errorMessage: '创建 YouTube 解析任务失败',
    errorCode: 'YOUTUBE_SUMMARY_CREATE_ERROR',
  })
}
