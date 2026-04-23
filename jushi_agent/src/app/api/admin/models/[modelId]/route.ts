import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function PUT(
    request: NextRequest,
    { params }: { params: { modelId: string } }
) {
    const body = await request.json()
    return proxyWithAuth(request, `/admin/models/${params.modelId}`, {
        method: 'PUT',
        body,
        successMessage: '更新系统模型成功',
        errorMessage: '更新系统模型失败',
        errorCode: 'UPDATE_ERROR',
    })
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { modelId: string } }
) {
    return proxyWithAuth(request, `/admin/models/${params.modelId}`, {
        method: 'DELETE',
        successMessage: '删除系统模型成功',
        errorMessage: '删除系统模型失败',
        errorCode: 'DELETE_ERROR',
    })
}
