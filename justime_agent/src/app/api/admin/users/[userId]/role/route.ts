import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params
    const body = await request.json()
    return proxyWithAuth(request, `/admin/users/${userId}/role`, {
        method: 'PUT',
        body,
        successMessage: '更新用户角色成功',
        errorMessage: '更新用户角色失败',
        errorCode: 'UPDATE_ERROR',
    })
}
