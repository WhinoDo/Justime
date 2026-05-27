import { NextRequest } from 'next/server'
import { proxyToBackend } from '@/lib/api/proxy'

/**
 * PATCH /api/chat/messages/[messageId]
 * 更新消息的交互状态（如清除任务分解数据、日程建议等）
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    const { messageId } = await params
    return proxyToBackend(request, `/chat/messages/${messageId}`)
}
