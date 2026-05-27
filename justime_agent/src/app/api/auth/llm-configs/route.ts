import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 获取用户的LLM配置列表
 * GET /api/auth/llm-configs
 */
export async function GET(request: NextRequest) {
    return proxyWithAuth(request, '/auth/llm-configs', {
        method: 'GET',
        successMessage: '获取配置列表成功',
        errorMessage: '获取配置列表失败',
        errorCode: 'FETCH_ERROR',
        cache: 'no-store',
    })
}

/**
 * 添加新的LLM配置
 * POST /api/auth/llm-configs
 */
export async function POST(request: NextRequest) {
    const body = await request.json()
    return proxyWithAuth(request, '/auth/llm-configs', {
        method: 'POST',
        body,
        successMessage: '添加配置成功',
        errorMessage: '添加配置失败',
        errorCode: 'CREATE_ERROR',
    })
}
