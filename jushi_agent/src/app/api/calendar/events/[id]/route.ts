/**
 * 单个日历事件API
 * GET - 获取事件详情
 * PUT - 更新事件
 * DELETE - 删除事件
 */

import { NextRequest } from 'next/server'
import { proxyToBackend, createErrorResponse } from '@/lib/api/proxy'

// GET - 获取事件详情
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return proxyToBackend(request, `/calendar/events/${params.id}`)
}

// PUT - 更新事件
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const payload = { ...body }
    delete payload.userId

    if (payload.start && payload.end) {
      const startDate = new Date(payload.start)
      const endDate = new Date(payload.end)

      if (startDate >= endDate) {
        return createErrorResponse('结束时间必须晚于开始时间', 'VALIDATION_ERROR', 400)
      }
    }

    return proxyToBackend(request, `/calendar/events/${params.id}`, {
      method: 'PUT',
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

// DELETE - 删除事件
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return proxyToBackend(request, `/calendar/events/${params.id}`, {
    method: 'DELETE',
  })
}
