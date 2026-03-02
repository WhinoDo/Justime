import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

export async function DELETE(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const backendUrl = API_CONFIG.getFullUrl(`/admin/users/${params.userId}`)
        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include'
        })

        const result = await response.json()
        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '删除用户失败', 'DELETE_ERROR', response.status)
        }

        return createSuccessResponse(result, '删除用户成功')
    } catch (error) {
        console.error('删除用户失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
