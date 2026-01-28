import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 设置当前激活的配置
 * PUT /api/auth/llm-configs/[id]/active
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        const id = params.id

        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const backendUrl = API_CONFIG.getFullUrl(`/auth/llm-configs/${id}/active`)

        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include'
        })

        const result = await response.json()

        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '设置激活失败', 'ACTIVATE_ERROR', response.status)
        }

        return createSuccessResponse(result.data ?? result, '设置激活成功')
    } catch (error) {
        console.error('激活LLM配置失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
