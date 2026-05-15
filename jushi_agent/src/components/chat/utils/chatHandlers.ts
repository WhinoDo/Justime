import { Message } from '@/types'
import { generateId } from '@/lib/utils'

/**
 * 创建用户消息对象
 */
export function createUserMessage(
  content: string,
  currentTaskId?: string
): Message {
  return {
    id: generateId(),
    user_id: 'current-user',
    role: 'user',
    content: content.trim(),
    task_id: currentTaskId,
    created_at: new Date().toISOString()
  }
}

/**
 * 发送聊天请求到 API
 */
export async function sendChatRequest(params: {
  message: string
  taskId?: string
  sessionId?: string | null
  useWebSearch: boolean
  runtimeModelId?: string
}): Promise<Response> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: params.message,
      taskId: params.taskId,
      sessionId: params.sessionId,
      useWebSearch: params.useWebSearch,
      runtimeModelId: params.runtimeModelId
    })
  })

  return response
}

/**
 * 处理聊天响应数据，创建助手消息
 */
export function processChatResponse(
  data: any,
  currentTaskId?: string
): Message {
  const responseContent = data.data?.response || data.data?.message || data.response || ''

  return {
    id: data.data?.messageId || generateId(),
    user_id: 'current-user',
    role: 'assistant',
    content: responseContent,
    task_id: currentTaskId,
    emotion_score: data.data?.emotionScore || data.data?.emotion_score,
    created_at: new Date().toISOString(),
    timingStrategy: data.data?.timingStrategy,
    taskAnalysis: data.data?.taskAnalysis,
    taskDecomposition: data.data?.taskDecomposition,
    multiTaskDecompositions: data.data?.multiTaskDecompositions,
    suggestedEvents: data.data?.suggestedEvents,
    ragReferences: data.data?.ragReferences
  }
}

/**
 * 根据错误详情生成友好的错误消息
 */
export function handleChatError(errorDetail: string, errorType: string): string {
  let errorMessage = `抱歉，发生了一些错误：${errorDetail}`

  if (errorDetail.includes('平台尚未配置可用的 AI 模型') || errorType === 'no_model_configured') {
    errorMessage = '平台尚未配置可用的 AI 模型，请联系管理员添加。'
  } else if (errorType === 'connection' || errorDetail.includes('Connection') || errorDetail.includes('连接')) {
    errorMessage = '连接失败：请检查您的网络连接和LLM配置是否正确。如果已配置模型，请前往"个人信息"页面检查配置。'
  } else if (errorDetail.includes('API密钥') || errorDetail.includes('api key') || errorDetail.includes('API key')) {
    errorMessage = 'API密钥错误：请检查您的LLM配置中的API密钥是否正确。'
  } else if (errorDetail.includes('模型') || errorDetail.includes('model') || errorDetail.includes('Model')) {
    errorMessage = '模型配置错误：请检查您的LLM配置中的模型ID是否正确。'
  } else if (errorDetail.includes('未配置') || errorDetail.includes('未定义')) {
    errorMessage = 'LLM未配置：请前往"个人信息"页面配置您的LLM模型和API密钥。'
  }

  return errorMessage
}

/**
 * 创建错误消息对象
 */
export function createErrorMessage(error: unknown): Message {
  return {
    id: generateId(),
    user_id: 'current-user',
    role: 'assistant',
    content: error instanceof Error ? error.message : '抱歉，发生了一些错误，请稍后重试',
    created_at: new Date().toISOString()
  }
}

/**
 * 转换后端消息格式为前端格式
 */
export function formatMessagesFromBackend(messages: any[]): Message[] {
  return messages.map((msg: any) => ({
    id: msg._id,
    user_id: msg.role === 'user' ? 'current-user' : 'ai',
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
    created_at: msg.timestamp,
    taskDecomposition: msg.taskDecomposition,
    multiTaskDecompositions: msg.multiTaskDecompositions,
    suggestedEvents: msg.suggestedEvents,
    timingStrategy: msg.timingStrategy,
    taskAnalysis: msg.taskAnalysis,
    ragReferences: msg.ragReferences
  }))
}
