import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 获取用户的LLM配置列表
 * GET /api/auth/llm-configs
 */
export async function GET(request: NextRequest) {
    try {
        const authToken = request.cookies.get('access_token')?.value

        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const backendUrl = API_CONFIG.getFullUrl('/auth/llm-configs')
        const response = await fetch(backendUrl, {
            method: 'GET',
            headers: {
                'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include',
            cache: 'no-store'
        })

        const result = await response.json()

        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '获取配置列表失败', 'FETCH_ERROR', response.status)
        }

        return createSuccessResponse(result.data ?? result, '获取配置列表成功')
    } catch (error) {
        console.error('获取LLM配置列表失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}

/**
 * 添加新的LLM配置
 * POST /api/auth/llm-configs
 */
export async function POST(request: NextRequest) {
    try {
        const authToken = request.cookies.get('access_token')?.value

        if (!authToken) {
            return createErrorResponse('请先登录', 'AUTHENTICATION_ERROR', 401)
        }

        const body = await request.json()
        const backendUrl = API_CONFIG.getFullUrl('/auth/llm-configs')

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
            },
            credentials: 'include',
            body: JSON.stringify(body)
        })

        const result = await response.json()

        if (!response.ok) {
            return createErrorResponse(result.detail || result.message || '添加配置失败', 'CREATE_ERROR', response.status)
        }

        return createSuccessResponse(result.data ?? result, '添加配置成功')
    } catch (error) {
        console.error('添加LLM配置失败:', error)
        return createErrorResponse('服务器内部错误', 'INTERNAL_ERROR', 500)
    }
}
