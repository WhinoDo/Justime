import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    const { userId } = await params
    return proxyWithAuth(request, `/admin/users/${userId}`, {
        method: 'DELETE',
        successMessage: '删除用户成功',
        errorMessage: '删除用户失败',
        errorCode: 'DELETE_ERROR',
    })
}
