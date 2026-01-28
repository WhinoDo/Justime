import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api/proxy';

export async function GET(
    request: NextRequest,
    { params }: { params: { sessionId: string } }
) {
    const sessionId = params.sessionId;
    return proxyToBackend(request, `/chat/sessions/${sessionId}/messages`);
}
