import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

export async function PUT(
    request: NextRequest,
    { params }: { params: { keyId: string } }
) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const body = await request.json()
        const backendUrl = API_CONFIG.getFullUrl(`/admin/apikeys/${params.keyId}`)
        const response = await fetch(backendUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            body: JSON.stringify(body),
            credentials: 'include'
        })

        const result = await response.json()
        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '更新 API Key 失败', 'UPDATE_ERROR', response.status)
        }

        return createSuccessResponse(result, '更新 API Key 成功')
    } catch (error) {
        console.error('更新 API Key 失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { keyId: string } }
) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const backendUrl = API_CONFIG.getFullUrl(`/admin/apikeys/${params.keyId}`)
        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include'
        })

        const result = await response.json()
        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '删除 API Key 失败', 'DELETE_ERROR', response.status)
        }

        return createSuccessResponse(result, '删除 API Key 成功')
    } catch (error) {
        console.error('删除 API Key 失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
