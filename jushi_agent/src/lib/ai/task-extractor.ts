import { OpenAI } from 'openai'

export interface TaskExtraction {
  hasTask: boolean
  taskTitle?: string
  taskDescription?: string
  taskType?: 'study' | 'assignment' | 'project' | 'exam_prep' | 'research' | 'other'
  urgency?: 'low' | 'medium' | 'high'
  estimatedDuration?: string
  requirements?: string[]
  reasoning?: string
}

export class TaskExtractor {
  private client: OpenAI | null = null

  constructor() {
    // 只有在有有效API密钥时才初始化客户端
    if (process.env.SILICONFLOW_API_KEY && process.env.SILICONFLOW_API_KEY !== 'test-api-key') {
      this.client = new OpenAI({
        apiKey: process.env.SILICONFLOW_API_KEY,
        baseURL: "https://api.siliconflow.cn/v1",
      })
      console.log('任务提取器: API客户端初始化成功')
    } else {
      console.warn('任务提取器: API密钥未配置，将使用本地规则提取')
    }
  }

  async extractTask(text: string): Promise<TaskExtraction> {
    // 如果没有配置有效的API密钥，使用本地规则提取
    if (!this.client) {
      console.warn('API密钥未配置或无效，使用本地规则提取任务')
      return this.getLocalTaskExtraction(text)
    }

    try {
      const response = await this.client.chat.completions.create({
        model: 'Qwen/Qwen2.5-72B-Instruct',
        messages: [{
          role: 'system',
          content: `你是专业的任务提取分析师。分析用户文本，判断是否包含明确的任务请求。

## 任务识别标准
只有当用户明确表达以下意图时才认为包含任务：
- 明确提到要"做"、"完成"、"写"、"学习"、"准备"某个具体事项
- 有明确的目标和可执行的内容
- 不是简单的咨询或情感表达

## 任务类型分类
- study: 学习某个知识点、概念
- assignment: 作业、练习题
- project: 项目、大作业
- exam_prep: 考试准备、复习
- research: 研究、调研
- other: 其他类型任务

## 紧急程度判断
- high: 明确提到"紧急"、"马上"、"今天"、"明天"等时间压力
- medium: 提到具体时间节点但不紧急
- low: 没有明确时间要求

重要：如果用户只是咨询问题、表达情感、寻求建议，而没有明确的任务执行意图，则hasTask应为false。

必须返回纯JSON格式，不要使用markdown代码块：
{"hasTask": boolean, "taskTitle": "string", "taskDescription": "string", "taskType": "string", "urgency": "string", "estimatedDuration": "string", "requirements": ["string"], "reasoning": "string"}`
        }, {
          role: 'user',
          content: text
        }],
        max_tokens: 500,
        temperature: 0.3,
      })

      const content = response.choices[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('AI返回内容为空')
      }

      // 尝试解析JSON响应
      try {
        const result = JSON.parse(content) as TaskExtraction
        console.log('任务提取结果:', result)
        return result
      } catch (parseError) {
        console.error('JSON解析失败:', parseError, '原始内容:', content)
        throw new Error('AI返回格式错误')
      }

    } catch (error: any) {
      console.error('任务提取失败:', error.message)
      // 降级到本地规则提取
      return this.getLocalTaskExtraction(text)
    }
  }

  private getLocalTaskExtraction(text: string): TaskExtraction {
    // 本地规则：检测任务关键词和模式
    const taskKeywords = [
      '完成', '做', '写', '学习', '准备', '复习', '练习', '研究', '分析', 
      '制定', '规划', '安排', '背诵', '记忆', '掌握', '理解', '解决'
    ]

    const taskObjects = [
      '作业', '论文', '报告', '项目', '考试', '测试', '实验', '课程设计',
      '毕业设计', '演讲', 'presentation', '代码', '程序', '算法', '数学题',
      '英语', '单词', '语法', '阅读', '听力', '口语', '写作'
    ]

    const urgencyKeywords = {
      high: ['紧急', '马上', '立即', '今天', '明天', '急需', '赶紧', '快速'],
      medium: ['这周', '下周', '几天内', '尽快', '近期'],
      low: ['有时间', '慢慢', '不急', '以后']
    }

    // 检查是否包含任务关键词和对象
    const hasTaskKeyword = taskKeywords.some(keyword => text.includes(keyword))
    const hasTaskObject = taskObjects.some(obj => text.includes(obj))
    
    // 必须同时包含动作词和任务对象才认为是任务
    const hasTask = hasTaskKeyword && hasTaskObject

    if (!hasTask) {
      return {
        hasTask: false,
        reasoning: '未检测到明确的任务执行意图'
      }
    }

    // 提取任务标题（简化版）
    let taskTitle = '学习任务'
    for (const obj of taskObjects) {
      if (text.includes(obj)) {
        taskTitle = obj
        break
      }
    }

    // 判断紧急程度
    let urgency: 'low' | 'medium' | 'high' = 'low'
    for (const [level, keywords] of Object.entries(urgencyKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        urgency = level as 'low' | 'medium' | 'high'
        break
      }
    }

    // 判断任务类型
    let taskType: TaskExtraction['taskType'] = 'other'
    if (text.includes('考试') || text.includes('复习')) taskType = 'exam_prep'
    else if (text.includes('作业') || text.includes('练习')) taskType = 'assignment'
    else if (text.includes('项目') || text.includes('设计')) taskType = 'project'
    else if (text.includes('学习') || text.includes('掌握')) taskType = 'study'
    else if (text.includes('研究') || text.includes('调研')) taskType = 'research'

    return {
      hasTask: true,
      taskTitle,
      taskDescription: text.length > 50 ? text.substring(0, 50) + '...' : text,
      taskType,
      urgency,
      estimatedDuration: urgency === 'high' ? '1-2小时' : urgency === 'medium' ? '2-4小时' : '灵活安排',
      requirements: ['明确具体目标', '制定执行计划'],
      reasoning: '基于关键词匹配检测到任务请求'
    }
  }
}
