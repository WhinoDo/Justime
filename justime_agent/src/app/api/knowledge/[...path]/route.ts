import { NextRequest, NextResponse } from 'next/server';
import { proxyToBackend } from '@/lib/api/proxy';
import { API_CONFIG } from '@/lib/api/config';

function buildAuthHeaders(request: NextRequest): Record<string, string> {
    const headers: Record<string, string> = {}
    const authHeader = request.headers.get('authorization')
    const cookieHeader = request.headers.get('cookie')

    if (authHeader) {
        headers['Authorization'] = authHeader
    } else if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=')
            if (key && value) acc[key] = value
            return acc
        }, {} as Record<string, string>)

        const accessToken = cookies['access_token']
        if (accessToken) {
            headers['Authorization'] = accessToken.startsWith('Bearer%20')
                ? accessToken.replace('Bearer%20', 'Bearer ')
                : `Bearer ${accessToken}`
        }
    }

    if (cookieHeader) {
        headers['Cookie'] = cookieHeader
    }

    return headers
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: pathSegments } = await params;
    const path = pathSegments.join('/');

    // raw 文件流接口不能经过 JSON 代理，否则二进制内容会损坏。
    if (path === 'raw') {
        const query = request.nextUrl.searchParams.toString()
        const backendUrl = API_CONFIG.getFullUrl(`/knowledge/raw${query ? `?${query}` : ''}`)
        const headers = buildAuthHeaders(request)
        const accept = request.headers.get('accept')
        if (accept) {
            headers['Accept'] = accept
        }

        try {
            const response = await fetch(backendUrl, {
                method: 'GET',
                headers,
                credentials: 'include',
            })

            const passthroughHeaders = new Headers()
            const contentType = response.headers.get('content-type')
            const contentDisposition = response.headers.get('content-disposition')
            const contentLength = response.headers.get('content-length')
            const cacheControl = response.headers.get('cache-control')
            if (contentType) passthroughHeaders.set('Content-Type', contentType)
            if (contentDisposition) passthroughHeaders.set('Content-Disposition', contentDisposition)
            if (contentLength) passthroughHeaders.set('Content-Length', contentLength)
            if (cacheControl) passthroughHeaders.set('Cache-Control', cacheControl)

            return new NextResponse(response.body, {
                status: response.status,
                headers: passthroughHeaders,
            })
        } catch (error) {
            return NextResponse.json(
                {
                    success: false,
                    error: error instanceof Error ? error.message : '代理文件流失败',
                },
                { status: 500 }
            )
        }
    }

    return proxyToBackend(request, `/knowledge/${path}`);
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: pathSegments } = await params;
    const path = pathSegments.join('/');
    // 对于文件上传，proxyToBackend 应该能处理 multipart/form-data
    return proxyToBackend(request, `/knowledge/${path}`);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: pathSegments } = await params;
    const path = pathSegments.join('/');
    return proxyToBackend(request, `/knowledge/${path}`);
}
