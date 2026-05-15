import type { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 测试模型配置连接
 * POST /api/admin/models/test
 * 
 * Body: { base_url: string, model_id: string, api_key?: string, api_key_id?: string }
 * - base_url: 模型服务地址
 * - model_id: 模型ID
 * - api_key: 手动输入的 API Key（明文，仅在测试时使用）
 * - api_key_id: 引用的系统 API Key ID（后端会自动解密）
 */
export async function POST(request: NextRequest) {
    const body = await request.json()
    
    return proxyWithAuth(request, '/admin/models/test', {
        method: 'POST',
        body,
        successMessage: '连接成功！模型配置可用',
        errorMessage: '连接测试失败',
        errorCode: 'TEST_ERROR',
    })
}
