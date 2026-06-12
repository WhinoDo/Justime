import { NextRequest } from 'next/server'
import { proxyWithAuth, createErrorResponse } from '@/lib/api/proxy'

function badRequest(message: string) {
  return createErrorResponse(message, 'CHAT_BAD_REQUEST', 400)
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return badRequest('请求体格式无效')
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return badRequest('请求体格式无效')
    }

    const parsedBody = body as Record<string, unknown>
    const { message, taskId, sessionId, useWebSearch, useOpenClaw, taskType, difficultyLevel, urgency, runtimeModelId } = parsedBody

    if (!message || typeof message !== 'string') {
      return badRequest('消息内容无效')
    }

    let normalizedRuntimeModelId: string | undefined
    if (runtimeModelId !== undefined) {
      if (typeof runtimeModelId !== 'string') {
        return badRequest('模型配置无效')
      }
      normalizedRuntimeModelId = runtimeModelId.trim()
      if (!normalizedRuntimeModelId) {
        return badRequest('模型配置无效')
      }
    }

    if (
      difficultyLevel !== undefined &&
      (typeof difficultyLevel !== 'number' || !Number.isInteger(difficultyLevel) || difficultyLevel < 1 || difficultyLevel > 5)
    ) {
      return badRequest('任务难度无效')
    }

    if (useWebSearch !== undefined && typeof useWebSearch !== 'boolean') {
      return badRequest('网页搜索开关无效')
    }

    if (useOpenClaw !== undefined && typeof useOpenClaw !== 'boolean') {
      return badRequest('OpenClaw 开关无效')
    }

    let normalizedSessionId: string | undefined
    if (sessionId !== undefined && sessionId !== null) {
      if (typeof sessionId !== 'string') {
        return badRequest('会话标识无效')
      }
      normalizedSessionId = sessionId.trim()
      if (!normalizedSessionId) {
        return badRequest('会话标识无效')
      }
    }

    let cleanMessage = message.trim()
    if (!cleanMessage) {
      return badRequest('消息内容不能为空')
    }

    const prefixedOpenClaw = /^\/openclaw(?:\s+|$)/.test(cleanMessage)
    if (prefixedOpenClaw) {
      cleanMessage = cleanMessage.replace(/^\/openclaw(?:\s+|$)/, '').trim()
    }
    if (!cleanMessage) {
      return badRequest('OpenClaw 指令不能为空')
    }

    if (cleanMessage.length > 1000) {
      return badRequest('消息内容过长，请缩短到1000字符以内')
    }

    return await proxyWithAuth(request, '/chat/', {
      method: 'POST',
      body: {
        message: cleanMessage,
        taskId,
        sessionId: normalizedSessionId,
        useWebSearch: !!useWebSearch,
        useOpenClaw: Boolean(useOpenClaw || prefixedOpenClaw),
        taskType,
        difficultyLevel,
        urgency,
        runtimeModelId: normalizedRuntimeModelId,
      },
      successMessage: '对话成功',
      errorMessage: '对话请求失败',
      errorCode: 'CHAT_ERROR',
    })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : '对话请求失败',
      'CHAT_ERROR',
      500,
    )
  }
}
