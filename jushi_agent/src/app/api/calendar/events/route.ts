/**
 * 日历事件API
 * GET - 获取事件列表
 * POST - 创建新事件
 */

import { NextRequest } from 'next/server'
import { proxyToBackend, createErrorResponse } from '@/lib/api/proxy'

// GET - 获取事件列表
export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/calendar/events')
}

// POST - 创建新事件
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const payload = { ...body }
    delete payload.userId

    if (!payload.title || !payload.start || !payload.end) {
      return createErrorResponse('缺少必需字段', 'VALIDATION_ERROR', 400)
    }

    return proxyToBackend(request, '/calendar/events', {
      method: 'POST',
      body: payload,
    })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : '请求参数无效',
      'VALIDATION_ERROR',
      400
    )
  }
}
