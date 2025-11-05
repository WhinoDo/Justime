import { NextRequest, NextResponse } from 'next/server'
import { EmotionAnalyzer } from '@/lib/ai/emotion-analyzer'
import { ChatGenerator } from '@/lib/ai/chat-generator'
import { TaskExtractor } from '@/lib/ai/task-extractor'
import { TaskDecomposer } from '@/lib/task/decomposer'
import { APIResponse, ChatRequest, ChatResponse } from '@/types'
import { TimeUtils } from '@/lib/utils/time'

const emotionAnalyzer = new EmotionAnalyzer()
const chatGenerator = new ChatGenerator()
const taskExtractor = new TaskExtractor()
const taskDecomposer = new TaskDecomposer()

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json()
    const { message, taskId } = body

    // 输入验证
    if (!message || typeof message !== 'string') {
      throw new Error('消息内容无效')
    }
    
    if (message.length > 1000) {
      throw new Error('消息内容过长，请缩短到1000字符以内')
    }

    // 清理输入
    const cleanMessage = message.trim()
    if (!cleanMessage) {
      throw new Error('消息内容不能为空')
    }

    // 获取当前时间上下文
    const timeContext = TimeUtils.getCurrentTimeContext()
    const timeContextString = TimeUtils.getTimeContextForAI()

    console.log('Chat API: 收到消息:', {
      message: cleanMessage.substring(0, 100),
      taskId,
      messageLength: cleanMessage.length,
      timestamp: timeContext.iso,
      currentTime: timeContext.formatted.datetime,
      timeOfDay: timeContext.timeOfDay
    })

    // 1. 分析情绪 - 添加错误处理
    console.log('开始情绪分析...')
    let emotionAnalysis
    try {
      emotionAnalysis = await emotionAnalyzer.analyzeEmotion(cleanMessage)
      console.log('情绪分析结果:', emotionAnalysis)
    } catch (error) {
      console.error('情绪分析失败:', error)
      // 使用默认值继续
      emotionAnalysis = { score: 7, tags: ['neutral'], reasoning: '分析失败，使用默认值' }
    }

    // 2. 提取任务信息 - 添加错误处理
    console.log('开始任务提取...')
    let taskExtraction
    try {
      taskExtraction = await taskExtractor.extractTask(cleanMessage)
      console.log('任务提取结果:', taskExtraction)
    } catch (error) {
      console.error('任务提取失败:', error)
      // 使用默认值继续
      taskExtraction = { hasTask: false, reasoning: '提取失败，使用默认值' }
    }

    // 3. 生成AI回复 - 添加错误处理
    console.log('开始生成AI回复...')
    let aiResult: { response: string; taskResult?: any }
    try {
      aiResult = await chatGenerator.generateResponse(
        cleanMessage,
        emotionAnalysis.score,
        emotionAnalysis.tags,
        taskExtraction,
        timeContextString
      )
      console.log('AI回复生成完成，长度:', aiResult.response.length)
      if (aiResult.taskResult) {
        console.log('检测到任务规划:', {
          hasTasks: aiResult.taskResult.hasTasks,
          taskCount: aiResult.taskResult.tasks?.length || 0
        })
      }
    } catch (error) {
      console.error('AI回复生成失败:', error)
      throw error // 重新抛出以触发外层错误处理
    }
    
    // 4. 构建响应
    const response: APIResponse<ChatResponse> = {
      success: true,
      data: {
        response: aiResult.response,
        emotionScore: emotionAnalysis.score,
        emotionTags: emotionAnalysis.tags,
        needsEmotionInput: emotionAnalysis.score <= 6, // 中度以下焦虑需要确认
        taskExtraction: taskExtraction,
        taskResult: aiResult.taskResult, // 添加任务规划结果
        suggestedActions: taskExtraction.hasTask ? ['task_decomposition'] : undefined
      },
      timestamp: new Date().toISOString()
    }

    console.log('Chat API: 响应生成成功')
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Chat API Error详情:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    })
    
    const errorResponse: APIResponse<ChatResponse> = {
      success: false,
      error: {
        code: 'CHAT_ERROR',
        message: '抱歉，我现在遇到了一些技术问题。请稍后再试，或者描述一下您遇到的具体情况。',
        details: process.env.NODE_ENV === 'development' ? String(error) : 
                 `Error: ${error instanceof Error ? error.message : String(error)}`
      },
      timestamp: new Date().toISOString()
    }

    return NextResponse.json(errorResponse, { status: 500 })
  }
}

