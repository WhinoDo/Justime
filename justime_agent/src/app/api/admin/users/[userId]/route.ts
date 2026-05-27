import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function DELETE(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    return proxyWithAuth(request, `/admin/users/${params.userId}`, {
        method: 'DELETE',
        successMessage: '删除用户成功',
        errorMessage: '删除用户失败',
        errorCode: 'DELETE_ERROR',
    })
}
