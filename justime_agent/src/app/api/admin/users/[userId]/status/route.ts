import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function PUT(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    const body = await request.json()
    return proxyWithAuth(request, `/admin/users/${params.userId}/status`, {
        method: 'PUT',
        body,
        successMessage: '更新用户状态成功',
        errorMessage: '更新用户状态失败',
        errorCode: 'UPDATE_ERROR',
    })
}
