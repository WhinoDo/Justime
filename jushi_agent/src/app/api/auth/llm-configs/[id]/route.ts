import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 更新指定的LLM配置
 * PUT /api/auth/llm-configs/[id]
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

        const body = await request.json()
        const backendUrl = API_CONFIG.getFullUrl(`/auth/llm-configs/${id}`)

        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include',
            body: JSON.stringify(body)
        })

        const result = await response.json()

        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '更新配置失败', 'UPDATE_ERROR', response.status)
        }

        return createSuccessResponse(result.data ?? result, '更新配置成功')
    } catch (error) {
        console.error('更新LLM配置失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}

/**
 * 删除指定的LLM配置
 * DELETE /api/auth/llm-configs/[id]
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        const id = params.id

        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const backendUrl = API_CONFIG.getFullUrl(`/auth/llm-configs/${id}`)

        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include'
        })

        const result = await response.json()

        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '删除配置失败', 'DELETE_ERROR', response.status)
        }

        return createSuccessResponse(result.data ?? result, '删除配置成功')
    } catch (error) {
        console.error('删除LLM配置失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
