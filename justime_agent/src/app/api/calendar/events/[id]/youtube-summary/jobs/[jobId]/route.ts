import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; jobId: string }> }
) {
  const { id, jobId } = await params
  return proxyWithAuth(request, `/calendar/events/${id}/youtube-summary/jobs/${jobId}`, {
    method: 'GET',
    successMessage: '查询 YouTube 解析任务成功',
    errorMessage: '查询 YouTube 解析任务失败',
    errorCode: 'YOUTUBE_SUMMARY_FETCH_ERROR',
    cache: 'no-store',
  })
}
