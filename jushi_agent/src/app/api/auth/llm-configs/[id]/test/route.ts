import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 测试指定的LLM配置
 * POST /api/auth/llm-configs/[id]/test
 */
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    return proxyWithAuth(request, `/auth/llm-configs/${params.id}/test`, {
        method: 'POST',
        successMessage: '测试配置成功',
        errorMessage: '测试配置失败',
        errorCode: 'TEST_ERROR',
    })
}
