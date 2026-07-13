import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ keyId: string }> }
) {
    const { keyId } = await params
    const body = await request.json()
    return proxyWithAuth(request, `/admin/apikeys/${keyId}`, {
        method: 'PUT',
        body,
        successMessage: '更新 API Key 成功',
        errorMessage: '更新 API Key 失败',
        errorCode: 'UPDATE_ERROR',
    })
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ keyId: string }> }
) {
    const { keyId } = await params
    return proxyWithAuth(request, `/admin/apikeys/${keyId}`, {
        method: 'DELETE',
        successMessage: '删除 API Key 成功',
        errorMessage: '删除 API Key 失败',
        errorCode: 'DELETE_ERROR',
    })
}
