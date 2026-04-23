import { NextRequest } from 'next/server'
import { proxyWithAuth } from '@/lib/api/proxy'

export async function GET(request: NextRequest) {
    return proxyWithAuth(request, '/admin/apikeys', {
        method: 'GET',
        successMessage: '获取 API Key 列表成功',
        errorMessage: '获取 API Key 列表失败',
        errorCode: 'FETCH_ERROR',
        cache: 'no-store',
    })
}

export async function POST(request: NextRequest) {
    const body = await request.json()
    return proxyWithAuth(request, '/admin/apikeys', {
        method: 'POST',
        body,
        successMessage: '新增 API Key 成功',
        errorMessage: '新增 API Key 失败',
        errorCode: 'CREATE_ERROR',
    })
}
