import { OpenAI } from 'openai'
import { TaskPlanner, TaskPlanResult } from './task-planner'
import { EXTERNAL_API_ENDPOINTS } from '@/lib/api/config'

export class ChatGenerator {
  private client: OpenAI | null = null

  constructor() {
    // 只有在有有效API密钥时才初始化客户端
    if (process.env.SILICONFLOW_API_KEY && process.env.SILICONFLOW_API_KEY !== 'test-api-key') {
      this.client = new OpenAI({
        apiKey: process.env.SILICONFLOW_API_KEY,
        baseURL: EXTERNAL_API_ENDPOINTS.SILICONFLOW.BASE_URL,
      })
      console.log('聊天生成器: API客户端初始化成功')
    } else {
      console.warn('聊天生成器: API密钥未配置，将使用模拟回复')
    }
  }

  async generateResponse(message: string, emotionScore: number, emotionTags: string[], taskExtraction?: any, timeContext?: string): Promise<{ response: string; taskResult?: TaskPlanResult }> {
    // 检测是否包含任务安排需求
    const hasTaskPlanning = TaskPlanner.analyzeMessage(message)

    // 如果没有配置有效的API密钥，返回模拟回复
    if (!this.client) {
      console.warn('API密钥未配置或无效，使用本地模板回复')
      const response = this.getLocalResponse(message, emotionScore, taskExtraction)
      return { response, taskResult: undefined }
    }

    try {
      // 根据情绪评分和任务信息构建系统提示
      let systemPrompt: string
      if (hasTaskPlanning) {
        systemPrompt = TaskPlanner.generateTaskPrompt(message, timeContext, emotionScore, emotionTags)
      } else {
        systemPrompt = this.buildEnhancedSystemPrompt(emotionScore, emotionTags, taskExtraction, timeContext)
      }

      const response = await this.client.chat.completions.create({
        model: 'Qwen/Qwen2.5-72B-Instruct', // 使用硅基流动支持的Qwen模型
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1500, // 增加 token 数量以支持结构化输出
        temperature: 0.6,
      })

      const aiResponse = response.choices[0]?.message?.content || '抱歉，我暂时无法生成回复。'
      console.log('AI回复生成成功:', aiResponse.substring(0, 100) + '...')

      // 如果包含任务规划，解析结构化数据
      if (hasTaskPlanning) {
        const taskResult = TaskPlanner.parseTaskResponse(aiResponse)
        return { response: taskResult.planText, taskResult }
      }

      return { response: aiResponse }

    } catch (error: any) {
      console.error('AI回复生成失败详情:', {
        error: error.message || error,
        stack: error.stack,
        apiKey: this.client ? '已配置' : '未配置',
        environment: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      })

      // 在生产环境中抛出错误而不是降级到模拟回复，这样可以看到真实的错误信息
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`API调用失败: ${error.message || error}`)
      }

      const response = this.getLocalResponse(message, emotionScore, taskExtraction)
      return { response }
    }
  }

  private buildEnhancedSystemPrompt(emotionScore: number, emotionTags: string[], taskExtraction?: any, timeContext?: string): string {
    const emotionContext = this.getEmotionContext(emotionScore)
    const tags = emotionTags.join('、')
    const toneStyle = this.getToneStyle(emotionScore)
    const hasTask = taskExtraction?.hasTask || false

    return `你是「矩时」，一个温暖贴心的AI学习伙伴，专门陪伴大学生度过学习和生活中的挑战。

## 你的性格特质
- 🌟 **温暖亲和**：像知心朋友一样理解和支持
- 🎯 **专业可靠**：拥有丰富的学习指导经验
- 💡 **耐心细致**：永远不会嫌弃任何"简单"的问题
- 🌱 **积极正向**：总是能找到希望和解决方案

## 当前用户状态感知
- 情绪温度：${emotionScore}/10 ${this.getEmotionEmoji(emotionScore)}
- 情绪标签：${tags}
- 状态描述：${emotionContext}

## 当前时间信息
${timeContext || '时间信息不可用'}

## 语言风格调整
${toneStyle}

## 回答策略
${this.getEnhancedResponseStrategy(emotionScore)}

## 🎯 当前用户情况分析
- 情绪状态：${emotionContext}
- 是否包含任务：${hasTask ? '是' : '否'}
${hasTask ? `- 任务类型：${taskExtraction.taskType || '未知'}
- 任务标题：${taskExtraction.taskTitle || '未指定'}
- 紧急程度：${taskExtraction.urgency || '未知'}` : ''}

## 🎯 回应策略选择

### 📝 纯情感支持场景（使用段落形式）：
当用户只表达情绪，没有具体任务时：
- 用温暖连贯的段落表达理解和支持
- 避免条目化列举，重点在于情感共鸣
- 提供心理安慰和情感陪伴

### 📋 纯任务指导场景（可使用步骤列举）：
当用户只提出任务需求，情绪状态良好时：
- 可以直接使用清晰的步骤分解
- 提供具体可操作的指导
- 使用结构化格式组织内容

### 🤝 **情绪+任务混合场景（重要！）**：
${hasTask && emotionScore <= 6 ? `
**当前就是这种情况！用户既有情绪困扰又有任务需求**

**必须按以下顺序回应：**
1. **第一部分：情感安慰**（段落形式）
   - 先用温暖的语言理解和安慰用户的情绪
   - 表达共情和支持，缓解焦虑情绪
   - 建立心理安全感和信任

2. **第二部分：任务规划**（步骤形式）
   - 再提供具体的任务分解和指导
   - 使用清晰的步骤和结构化格式
   - 确保任务安排符合用户当前情绪状态

**重要：绝不能跳过情感安慰直接进入任务规划！**
` : '当用户同时表达情绪和任务需求时，先给予情感支持，再提供任务指导。'}

### 📏 通用要求：
控制在500-600字，根据场景灵活选择表达方式，始终保持温暖和专业。

请严格按照上述策略回应用户。`
  }

  private getToneStyle(emotionScore: number): string {
    if (emotionScore <= 3) {
      return `🤗 **极度温柔模式**：
- 用最温暖的语言，像妈妈一样关怀
- 多用"我理解你的感受"、"这很正常"等共情表达
- 避免任何可能增加压力的词汇
- 用"我们一起"而不是"你应该"
- 语调轻柔，充满耐心和包容`
    } else if (emotionScore <= 6) {
      return `😊 **温暖鼓励模式**：
- 用亲切友好的语言，像好朋友一样支持
- 适当使用"加油"、"你可以的"等鼓励词汇
- 保持积极正向的语调
- 用"让我们"、"一起来"等协作表达
- 既温暖又充满信心`
    } else {
      return `🌟 **活力伙伴模式**：
- 用充满活力的语言，像学习伙伴一样交流
- 可以使用"太棒了"、"很有想法"等赞美
- 语调轻松愉快，充满正能量
- 用"我们可以探索"、"让我们深入"等探索表达
- 既专业又富有激情`
    }
  }

  private getEmotionEmoji(emotionScore: number): string {
    if (emotionScore <= 2) return '😰'
    if (emotionScore <= 4) return '😟'
    if (emotionScore <= 6) return '😐'
    if (emotionScore <= 8) return '🙂'
    return '😊'
  }

  private getEnhancedResponseStrategy(emotionScore: number): string {
    if (emotionScore <= 3) {
      return `💝 **极度关怀策略**：
🫂 **情感支持时**：用温暖连贯的语言给予理解和安慰，避免过多条目列举，重点在于情感共鸣和心理支持。用"我理解你的感受"、"我们一起面对"等陪伴语言，提供心理安全感。

📋 **任务指导时**：将复杂问题拆解成最小的可执行步骤，可以使用清晰的步骤列举，强调每个小进步都值得庆祝。`
    } else if (emotionScore <= 6) {
      return `🌈 **温暖指导策略**：
😊 **情感支持时**：用亲切友好的段落形式表达理解和鼓励，保持温暖的支持性语调，避免机械化的条目罗列。

� **任务指导时**：可以提供清晰的学习路径和结构化解决方案，用生动的例子和类比帮助理解，适当使用步骤分解。`
    } else {
      return `🚀 **积极探索策略**：
🌟 **情感支持时**：用充满活力的语言表达赞美和鼓励，保持轻松愉快的语调，重点在于激发学习热情。

🧠 **任务指导时**：可以提供深入的知识拓展和技术细节，使用结构化的步骤和方法，引发思考并推荐进阶资源。`
    }
  }



  private getEmotionContext(score: number): string {
    if (score <= 2) return '内心很不安，需要温暖的陪伴和支持'
    if (score <= 4) return '感到有些焦虑，需要温和的理解和引导'
    if (score <= 6) return '情绪有些波动，需要清晰的方向和鼓励'
    if (score <= 8) return '状态还不错，可以接受一些小挑战'
    return '心情很好，充满学习的动力和热情'
  }

  private getLocalResponse(message: string, emotionScore: number, taskExtraction?: any): string {
    // 根据情绪评分和任务信息提供合适格式的本地回复
    const hasTask = taskExtraction?.hasTask || false
    const isTaskRelated = hasTask || this.isTaskRelatedMessage(message)

    const responses = {
      high_anxiety: {
        emotional: [
          "🤗 我能感受到你现在的不安，这种感觉我完全理解。让我们先暂停一下，深吸一口气好吗？你知道吗，每个人在面对挑战时都会有这样的感受，这说明你很在乎，这是件好事呢！我想告诉你，你已经很勇敢了，因为你愿意寻求帮助。让我陪着你慢慢来，我们一起面对这个挑战。",
          "😌 亲爱的，感到焦虑是完全正常的，特别是当我们想要做好某件事的时候。我想先告诉你，你现在的感受是可以理解的，很多人都会经历这样的时刻。重要的是，你选择了寻求帮助，这本身就是一种勇气和智慧。让我陪着你一起慢慢理清思路，我们会找到解决的方法。"
        ],
        task: [
          "🤗 我理解你现在的压力，让我们把这个任务分解成几个温和的小步骤：\n\n1. 首先深吸一口气，放松心情\n2. 明确最核心的目标\n3. 选择一个最简单的开始点\n4. 专注完成第一个小步骤\n\n记住，每完成一个小步骤都是进步，我们一步一步来。"
        ],
        mixed: [
          "🤗 我能感受到你现在的不安和压力，这种感觉我完全理解。面对任务时感到焦虑是很正常的，说明你很在乎这件事。让我先告诉你，你已经很勇敢了，因为你愿意寻求帮助。\n\n现在让我陪着你一起来处理这个任务：\n\n**温和的行动计划：**\n1. 先深吸一口气，放松心情\n2. 明确最核心的目标\n3. 选择一个最简单的开始点\n4. 专注完成第一个小步骤\n\n记住，我们一步一步来，每个小进步都值得庆祝。"
        ]
      },
      medium_anxiety: {
        emotional: [
          "😊 我理解你现在的困惑，这个问题确实值得好好思考一下。你知道吗，提出这样的问题本身就说明你在认真学习，这让我很欣慰！每个人在学习过程中都会遇到困惑的时刻，这是成长的必经之路。让我用最清晰的方式来帮助你理解。",
          "🌟 这是个很棒的问题！我能感受到你对学习的认真态度。困惑和思考往往是深度学习的开始，你现在的状态说明你正在真正地思考和探索。让我们一起深入分析一下这个概念的本质，我相信通过我们的探讨，你会有很大的收获。"
        ],
        task: [
          "😊 我来帮你制定一个清晰的计划：\n\n**第一阶段：准备工作**\n- 收集相关资料\n- 明确具体要求\n\n**第二阶段：执行计划**\n- 按优先级安排任务\n- 设定合理的时间节点\n\n**第三阶段：检查完善**\n- 回顾和调整\n- 确保质量达标"
        ],
        mixed: [
          "😊 我理解你现在的困惑和一些担心，这个问题确实值得好好思考。你知道吗，在面对任务时有些焦虑是很正常的，这说明你对结果很在意。让我先安慰你一下，你的想法很有价值，我们一定能找到好的解决方案。\n\n现在让我来帮你制定一个清晰的计划：\n\n**第一阶段：准备工作**\n- 收集相关资料\n- 明确具体要求\n\n**第二阶段：执行计划**\n- 按优先级安排任务\n- 设定合理的时间节点\n\n**第三阶段：检查完善**\n- 回顾和调整\n- 确保质量达标"
        ]
      },
      low_anxiety: {
        emotional: [
          "🎉 哇，你提出了一个非常有深度的问题！我能感受到你对知识的渴望和探索精神，这真的很棒！这种积极的学习态度会带你走得更远。你的思考角度很有意思，让我们一起来深入探讨这个概念的精彩细节和实际应用，我相信这会是一次很有意思的学习之旅。",
          "🚀 太棒了！你的学习态度让我印象深刻。我能感受到你对这个领域的热情和好奇心，这种积极的探索精神正是深度学习所需要的。我很兴奋能和你分享一些进阶的思考角度和学习资源，相信这些会让你的学习更上一层楼。"
        ],
        task: [
          "🚀 很好！让我为你设计一个进阶的学习计划：\n\n**深度探索阶段：**\n1. 核心概念掌握\n2. 实践应用练习\n3. 拓展知识学习\n\n**挑战提升阶段：**\n1. 复杂问题解决\n2. 创新思维训练\n3. 成果展示分享\n\n这个计划会帮你系统性地提升能力！"
        ],
        mixed: [
          "🎉 哇，你提出了一个很有深度的问题！我能感受到你对这个任务的热情，同时也察觉到你可能有一些小小的担心。这种既兴奋又谨慎的心情很正常，说明你既有探索精神又很负责任。\n\n让我为你设计一个既有挑战性又很实用的计划：\n\n**深度探索阶段：**\n1. 核心概念掌握\n2. 实践应用练习\n3. 拓展知识学习\n\n**挑战提升阶段：**\n1. 复杂问题解决\n2. 创新思维训练\n3. 成果展示分享\n\n这个计划会帮你系统性地提升能力，相信你一定能做得很棒！"
        ]
      }
    }

    let category = 'medium_anxiety'
    if (emotionScore <= 4) category = 'high_anxiety'
    else if (emotionScore >= 8) category = 'low_anxiety'

    // 判断回复类型：情绪+任务混合场景优先
    let responseType = 'emotional'
    if (hasTask && emotionScore <= 6) {
      // 情绪不佳且有任务 -> 混合回复（先安慰再规划）
      responseType = 'mixed'
    } else if (isTaskRelated && emotionScore > 6) {
      // 情绪良好且有任务 -> 纯任务回复
      responseType = 'task'
    } else if (isTaskRelated) {
      // 有任务但情绪不佳 -> 混合回复
      responseType = 'mixed'
    }
    // 其他情况默认为情感支持

    const categoryResponses = responses[category as keyof typeof responses]
    const responseList = (categoryResponses as any)[responseType] || categoryResponses.emotional
    return responseList[Math.floor(Math.random() * responseList.length)]
  }

  private isTaskRelatedMessage(message: string): boolean {
    const taskKeywords = [
      '任务', '计划', '安排', '步骤', '怎么做', '如何', '方法', '学习计划',
      '时间安排', '复习计划', '作业', '项目', '论文', '考试准备', '学习方法'
    ]
    return taskKeywords.some(keyword => message.includes(keyword))
  }
} 