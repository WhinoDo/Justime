import { NextRequest, NextResponse } from 'next/server'
import { createErrorResponse, createSuccessResponse } from '@/lib/api/proxy'

/**
 * 测试LLM API连接
 * POST /api/llm/test-connection
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { baseUrl, apiKey } = body

        if (!baseUrl || !apiKey) {
            return createErrorResponse('缺少 baseUrl 或 apiKey', 'VALIDATION_ERROR', 400)
        }

        // 构建验证的URL (简单请求模型列表)
        // 兼容 OpenAI 格式的 API 都会有 /models 端点
        let url = baseUrl
        if (!url.endsWith('/')) url += '/'
        url += 'models'

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`
            }
        })

        if (!response.ok) {
            let errorMsg = `连接失败 (HTTP ${response.status})`
            try {
                const errData = await response.json()
                if (errData.error?.message) {
                    errorMsg = errData.error.message
                }
            } catch (e) {
                // Ignore parsing errors
                const text = await response.text()
                if (text) errorMsg += `: ${text.substring(0, 100)}`
            }
            return createErrorResponse(errorMsg, 'CONNECTION_ERROR', response.status)
        }

        return createSuccessResponse(null, '连接成功！API 密钥和地址可用。')
    } catch (error) {
        console.error('测试LLM连接失败:', error)
        return createErrorResponse(
            error instanceof Error ? error.message : '网络请求失败，请检查 Base URL 是否正确',
            'NETWORK_ERROR',
            500
        )
    }
}
