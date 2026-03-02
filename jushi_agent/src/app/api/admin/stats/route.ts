import { NextRequest } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('access_token')?.value
        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const backendUrl = API_CONFIG.getFullUrl('/admin/stats')
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include',
            cache: 'no-store'
        })

        const result = await response.json()
        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '获取系统统计失败', 'FETCH_ERROR', response.status)
        }

        return createSuccessResponse(result, '获取系统统计成功')
    } catch (error) {
        console.error('获取系统统计失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
