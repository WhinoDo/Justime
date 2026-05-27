
import { NextRequest, NextResponse } from 'next/server'
import { API_CONFIG } from '@/lib/api/config'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 测试LLM连接API路由
 * POST /api/chat/test
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        // 输入验证
        if (!body.modelId || !body.baseUrl || !body.apiKey) {
            return createErrorResponse('缺少必要的配置参数', 'INVALID_CONFIG', 400)
        }

        // 获取认证token
        const authToken = request.cookies.get('access_token')?.value

        // 调用后端API
        const backendUrl = API_CONFIG.getFullUrl('/chat/test')

        const headers: HeadersInit = {
            'Content-Type': 'application/json'
        }

        if (authToken) {
            headers['Authorization'] = authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`
        }

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        })

        const result = await response.json()

        if (!response.ok) {
            // 透传后端返回的错误信息
            return NextResponse.json(result, { status: response.status })
        }

        return NextResponse.json(result)

    } catch (error) {
        console.error('测试LLM连接失败:', error)
        return createErrorResponse('连接测试过程中发生内部错误', 'INTERNAL_ERROR', 500)
    }
}
