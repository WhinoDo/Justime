import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 更新指定的LLM配置
 * PUT /api/auth/llm-configs/[id]
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const body = await request.json()
    return proxyWithAuth(request, `/auth/llm-configs/${params.id}`, {
        method: 'PUT',
        body,
        successMessage: '更新配置成功',
        errorMessage: '更新配置失败',
        errorCode: 'UPDATE_ERROR',
    })
}

/**
 * 删除指定的LLM配置
 * DELETE /api/auth/llm-configs/[id]
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    return proxyWithAuth(request, `/auth/llm-configs/${params.id}`, {
        method: 'DELETE',
        successMessage: '删除配置成功',
        errorMessage: '删除配置失败',
        errorCode: 'DELETE_ERROR',
    })
}
