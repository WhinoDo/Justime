import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'

function resolveAuthHeader(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    return authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`
  }
  const token = request.cookies.get('access_token')?.value
  if (!token) {
    return null
  }
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = resolveAuthHeader(request)
    if (!auth) {
      return NextResponse.json(
        { success: false, error: '请先登录' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const backendUrl = API_CONFIG.getFullUrl(
      `/calendar/events/${params.id}/youtube-summary/jobs`
    )
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify(body || {}),
    })

    const data = await response.json().catch(() => ({}))
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('创建 YouTube 解析任务失败:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '服务器内部错误',
      },
      { status: 500 }
    )
  }
}
