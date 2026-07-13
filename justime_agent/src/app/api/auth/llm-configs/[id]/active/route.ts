import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

/**
 * 设置当前激活的配置
 * PUT /api/auth/llm-configs/[id]/active
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    return proxyWithAuth(request, `/auth/llm-configs/${id}/active`, {
        method: 'PUT',
        successMessage: '设置激活成功',
        errorMessage: '设置激活失败',
        errorCode: 'ACTIVATE_ERROR',
    })
}
