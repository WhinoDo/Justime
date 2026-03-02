import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 测试指定的LLM配置
 * POST /api/auth/llm-configs/[id]/test
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        const id = params.id

        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const backendUrl = API_CONFIG.getFullUrl(`/auth/llm-configs/${id}/test`)

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include'
        })

        const result = await response.json()

        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '测试配置失败', 'TEST_ERROR', response.status)
        }

        return createSuccessResponse(result.data ?? result, result.message || '测试配置成功')
    } catch (error) {
        console.error('测试LLM配置失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
