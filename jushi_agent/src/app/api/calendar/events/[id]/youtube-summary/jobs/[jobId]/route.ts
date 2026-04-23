import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; jobId: string } }
) {
  return proxyWithAuth(request, `/calendar/events/${params.id}/youtube-summary/jobs/${params.jobId}`, {
    method: 'GET',
    successMessage: '查询 YouTube 解析任务成功',
    errorMessage: '查询 YouTube 解析任务失败',
    errorCode: 'YOUTUBE_SUMMARY_FETCH_ERROR',
    cache: 'no-store',
  })
}
