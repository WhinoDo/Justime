import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 动态获取供应商支持的模型列表
 * GET /api/auth/provider-models
 */
export async function GET(request: NextRequest) {
    try {
        // 验证用户身份
        const authToken = request.cookies.get('access_token')?.value

        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        // 调用后端API
        const backendUrl = API_CONFIG.getFullUrl('/auth/provider-models')
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include'
        })

        const result = await response.json()
        console.log('Provider models payload from backend:', result)

        if (!response.ok || !result.success) {
            return createErrorResponse(result.message || result.detail || '获取供应商模型列表失败', 'FETCH_ERROR', response.ok ? 400 : response.status)
        }

        return createSuccessResponse(result.data ?? result, '获取供应商模型列表成功')
    } catch (error) {
        console.error('获取供应商模型列表失败:', error)
        return NextResponse.json({
            success: false,
            error: '服务器内部错误'
        }, { status: 500 })
    }
}
