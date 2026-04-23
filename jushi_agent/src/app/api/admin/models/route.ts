import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
    return proxyWithAuth(request, '/admin/models', {
        method: 'GET',
        successMessage: '获取系统模型成功',
        errorMessage: '获取系统模型失败',
        errorCode: 'FETCH_ERROR',
        cache: 'no-store',
    })
}

export async function POST(request: NextRequest) {
    const body = await request.json()
    return proxyWithAuth(request, '/admin/models', {
        method: 'POST',
        body,
        successMessage: '新增系统模型成功',
        errorMessage: '新增系统模型失败',
        errorCode: 'CREATE_ERROR',
    })
}
