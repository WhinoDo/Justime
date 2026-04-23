import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
    return proxyWithAuth(request, '/admin/stats', {
        method: 'GET',
        successMessage: '获取系统统计成功',
        errorMessage: '获取系统统计失败',
        errorCode: 'FETCH_ERROR',
        cache: 'no-store',
    })
}
