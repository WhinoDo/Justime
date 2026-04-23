import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
    return proxyWithAuth(request, '/admin/users', {
        method: 'GET',
        successMessage: '获取用户列表成功',
        errorMessage: '获取用户列表失败',
        errorCode: 'FETCH_ERROR',
        cache: 'no-store',
    })
}
