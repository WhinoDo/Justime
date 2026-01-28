import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api/proxy';

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    const path = params.path.join('/');
    return proxyToBackend(request, `/knowledge/${path}`);
}

export async function POST(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    const path = params.path.join('/');
    // 对于文件上传，proxyToBackend 应该能处理 multipart/form-data
    return proxyToBackend(request, `/knowledge/${path}`);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    const path = params.path.join('/');
    return proxyToBackend(request, `/knowledge/${path}`);
}
