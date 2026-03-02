import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

export async function PUT(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const body = await request.json()
        const backendUrl = API_CONFIG.getFullUrl(`/admin/users/${params.userId}/status`)
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
            return createErrorResponse(result.detail || result.message || '更新用户状态失败', 'UPDATE_ERROR', response.status)
        }

        return createSuccessResponse(result, '更新用户状态成功')
    } catch (error) {
        console.error('更新用户状态失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
