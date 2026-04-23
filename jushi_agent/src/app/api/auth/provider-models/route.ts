import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 动态获取供应商支持的模型列表
 * GET /api/auth/provider-models
 */
export async function GET(request: NextRequest) {
    return proxyWithAuth(request, '/auth/provider-models', {
        method: 'GET',
        successMessage: '获取供应商模型列表成功',
        errorMessage: '获取供应商模型列表失败',
        errorCode: 'FETCH_ERROR',
    })
}
