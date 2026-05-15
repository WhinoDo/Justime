import { ChatGenerator } from '../chat-generator'

const originalEnv = process.env

describe('ChatGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, SILICONFLOW_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('constructor', () => {
    it('没有有效API密钥时应该使用模拟模式', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      new ChatGenerator()
      expect(consoleWarnSpy).toHaveBeenCalledWith('聊天生成器: API密钥未配置，将使用模拟回复')
      consoleWarnSpy.mockRestore()
    })
  })

  describe('generateResponse', () => {
    it('没有API客户端时应该返回本地回复', async () => {
      const generator = new ChatGenerator()
      const result = await generator.generateResponse('你好', 5, [])

      expect(result.response).toBeDefined()
      expect(result.taskResult).toBeUndefined()
    })

    it('应该根据情绪分数返回不同的回复', async () => {
      const generator = new ChatGenerator()

      const lowEmotionResult = await generator.generateResponse('我很焦虑', 2, [])
      const highEmotionResult = await generator.generateResponse('我很开心', 9, [])

      expect(lowEmotionResult.response).toBeDefined()
      expect(highEmotionResult.response).toBeDefined()
    })

    it('应该处理任务相关消息', async () => {
      const generator = new ChatGenerator()
      const result = await generator.generateResponse('帮我制定学习计划', 5, [])

      expect(result.response).toBeDefined()
    })

    it('应该处理情绪标签', async () => {
      const generator = new ChatGenerator()
      const result = await generator.generateResponse('我很难过', 3, ['焦虑', '压力'])

      expect(result.response).toBeDefined()
    })

    it('应该处理任务提取信息', async () => {
      const generator = new ChatGenerator()
      const taskExtraction = {
        hasTask: true,
        taskTitle: '学习英语',
        taskType: 'study',
      }
      const result = await generator.generateResponse('我要学习英语', 5, [], taskExtraction)

      expect(result.response).toBeDefined()
    })

    it('应该处理时间上下文', async () => {
      const generator = new ChatGenerator()
      const result = await generator.generateResponse('明天有什么安排', 5, [], undefined, '当前时间: 2025-01-01 10:00')

      expect(result.response).toBeDefined()
    })
  })
})
