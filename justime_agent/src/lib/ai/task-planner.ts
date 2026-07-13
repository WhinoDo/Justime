/**
 * 任务计划分析器
 * 用于检测用户消息中的任务安排需求，并生成结构化的任务数据
 */

export interface TaskItem {
  id: string
  title: string
  description?: string
  startTime: string // ISO 字符串
  endTime: string   // ISO 字符串
  priority: 'high' | 'medium' | 'low'
  category?: string
  location?: string
  reminders?: number[] // 提前提醒时间（分钟）
}

export interface TaskPlanResult {
  hasTasks: boolean
  tasks: TaskItem[]
  planText: string // AI 生成的计划文本
}

export class TaskPlanner {
  /**
   * 分析用户消息是否包含任务安排需求
   */
  static analyzeMessage(message: string): boolean {
    const taskKeywords = [
      '计划', '安排', '任务', '日程', '时间表', '规划',
      '会议', '活动', '事项', '待办', '提醒', '预约',
      '明天', '下周', '今天', '后天', '周一', '周二', '周三', '周四', '周五',
      '上午', '下午', '晚上', '早上', '中午',
      '几点', '时间', '什么时候', '何时'
    ]

    const timeKeywords = [
      '\\d{1,2}[：:点]\\d{0,2}', // 时间格式：9:30, 9点30, 9：30
      '\\d{1,2}月\\d{1,2}日?', // 日期格式：3月15日, 3月15
      '星期[一二三四五六日天]', // 星期
      '周[一二三四五六日天]', // 周
      '今天|明天|后天|大后天',
      '上午|下午|晚上|早上|中午|傍晚'
    ]

    // 检查是否包含任务关键词
    const hasTaskKeywords = taskKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    )

    // 检查是否包含时间关键词
    const hasTimeKeywords = timeKeywords.some(pattern => 
      new RegExp(pattern).test(message)
    )

    return hasTaskKeywords || hasTimeKeywords
  }

  /**
   * 生成任务计划的 AI 提示词
   */
  static generateTaskPrompt(userMessage: string, timeContext?: string, emotionScore?: number, emotionTags?: string[]): string {
    const emotionContext = emotionScore ? TaskPlanner.getEmotionContext(emotionScore) : ''
    const tags = emotionTags?.join('、') || ''

    return `
你是「Justime」，一个温暖贴心的AI学习伙伴。用户向你寻求任务规划帮助，请：

1. **首先进行情绪安抚**：理解用户的情绪状态，给予温暖的支持和鼓励
2. **然后制定详细计划**：生成具体的任务安排和时间规划
3. **最后输出结构化数据**：提供JSON格式的任务数据

## 当前时间信息
${timeContext || '时间信息不可用'}

## 用户情绪状态
${emotionScore ? `- 情绪温度：${emotionScore}/10` : ''}
${tags ? `- 情绪标签：${tags}` : ''}
${emotionContext ? `- 状态描述：${emotionContext}` : ''}

用户消息：${userMessage}

**重要提示**：请根据当前时间来安排任务的具体时间。例如：
- 如果用户说"明天上午"，请根据当前日期计算明天的具体日期
- 如果用户说"下周"，请根据当前日期计算下周的具体日期
- 如果用户说"2小时后"，请根据当前时间计算具体的开始时间
- 所有时间都应该使用 ISO 8601 格式（如：2025-01-04T09:00:00.000Z）

请按以下格式回复：

## 💝 情绪支持

[首先对用户的情绪状态表示理解和支持，给予温暖的鼓励。根据用户的情绪状态调整语言风格：
- 如果用户焦虑或压力大，先安抚情绪，表示理解
- 如果用户迷茫，给予方向指引和信心
- 如果用户疲惫，表达关怀并鼓励适当休息
- 用温暖、亲切的语言，像朋友一样交流]

## 📅 任务计划

[这里写详细的计划内容，包括时间安排、任务描述等。语言要积极正面，体现对用户能力的信心]

## 🔧 结构化数据

\`\`\`json
{
  "hasTasks": true,
  "tasks": [
    {
      "id": "task_1",
      "title": "任务标题",
      "description": "任务描述",
      "startTime": "2025-01-04T09:00:00.000Z",
      "endTime": "2025-01-04T10:00:00.000Z",
      "priority": "medium",
      "category": "工作",
      "location": "会议室A",
      "reminders": [15, 5]
    }
  ]
}
\`\`\`

注意：
- 如果用户消息不包含明确的任务安排需求，请设置 "hasTasks": false
- 时间请使用 ISO 8601 格式
- 优先级分为：high（高）、medium（中）、low（低）
- 提醒时间单位为分钟（提前多少分钟提醒）
- 如果时间不明确，请根据上下文合理推测
`
  }

  /**
   * 根据情绪分数获取情绪上下文描述
   */
  private static getEmotionContext(score: number): string {
    if (score >= 8) return '情绪状态良好，充满活力和动力'
    if (score >= 6) return '情绪相对稳定，有一定的积极性'
    if (score >= 4) return '情绪中等，可能有些许压力或困扰'
    if (score >= 2) return '情绪较低落，需要关怀和支持'
    return '情绪状态不佳，需要特别的理解和帮助'
  }

  /**
   * 解析 AI 回复中的结构化数据
   */
  static parseTaskResponse(aiResponse: string): TaskPlanResult {
    try {
      // 提取 JSON 数据
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/)
      if (!jsonMatch) {
        return {
          hasTasks: false,
          tasks: [],
          planText: aiResponse
        }
      }

      const jsonData = JSON.parse(jsonMatch[1])
      
      // 提取计划文本（去除结构化数据部分）
      const planText = aiResponse
        .replace(/## 🔧 结构化数据[\s\S]*$/, '')
        .replace(/```json[\s\S]*?```/, '')
        .trim()

      return {
        hasTasks: jsonData.hasTasks || false,
        tasks: jsonData.tasks || [],
        planText: planText || aiResponse
      }
    } catch (error) {
      console.error('解析任务数据失败:', error)
      return {
        hasTasks: false,
        tasks: [],
        planText: aiResponse
      }
    }
  }

  /**
   * 验证任务数据的有效性
   */
  static validateTask(task: TaskItem): boolean {
    if (!task.id || !task.title) {
      return false
    }

    try {
      const startTime = new Date(task.startTime)
      const endTime = new Date(task.endTime)
      
      if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
        return false
      }

      if (startTime >= endTime) {
        return false
      }

      return true
    } catch {
      return false
    }
  }

  /**
   * 生成任务的默认时间（如果时间不明确）
   */
  static generateDefaultTime(task: Partial<TaskItem>): { startTime: string; endTime: string } {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0) // 默认明天上午9点

    const startTime = tomorrow.toISOString()
    const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString() // 默认1小时

    return { startTime, endTime }
  }

  /**
   * 转换为飞书日程格式
   */
  static convertToFeishuEvent(task: TaskItem) {
    return {
      calendar_id: undefined, // 将使用主日历
      title: task.title,
      description: task.description || '',
      start_time: task.startTime,
      end_time: task.endTime,
      location: task.location,
      need_notification: task.reminders && task.reminders.length > 0,
      reminders: task.reminders?.map(minutes => ({
        minutes: minutes
      })),
      visibility: 'default' as const,
      free_busy_status: 'busy' as const,
      type: 'full' as const
    }
  }
}
