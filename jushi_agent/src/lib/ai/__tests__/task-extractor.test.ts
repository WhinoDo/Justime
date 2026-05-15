import { TaskExtractor } from '../task-extractor'

const originalEnv = process.env

describe('TaskExtractor', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv, SILICONFLOW_API_KEY: 'test-api-key' }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('constructor', () => {
    it('没有有效API密钥时应该使用本地规则模式', () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
      new TaskExtractor()
      expect(consoleWarnSpy).toHaveBeenCalledWith('任务提取器: API密钥未配置，将使用本地规则提取')
      consoleWarnSpy.mockRestore()
    })
  })

  describe('extractTask', () => {
    it('应该使用本地规则提取任务', async () => {
      const extractor = new TaskExtractor()
      const result = await extractor.extractTask('我要完成数学作业')

      expect(result.hasTask).toBe(true)
      expect(result.taskTitle).toBeDefined()
    })

    it('没有任务关键词时应返回 hasTask: false', async () => {
      const extractor = new TaskExtractor()
      const result = await extractor.extractTask('今天天气怎么样')

      expect(result.hasTask).toBe(false)
      expect(result.reasoning).toBe('未检测到明确的任务执行意图')
    })

    it('应该检测紧急程度', async () => {
      const extractor = new TaskExtractor()

      const highUrgency = await extractor.extractTask('今天要完成作业')
      expect(highUrgency.urgency).toBe('high')

      const mediumUrgency = await extractor.extractTask('这周要完成作业')
      expect(mediumUrgency.urgency).toBe('medium')

      const lowUrgency = await extractor.extractTask('有时间完成作业')
      expect(lowUrgency.urgency).toBe('low')
    })

    it('应该正确分类任务类型', async () => {
      const extractor = new TaskExtractor()

      const examTask = await extractor.extractTask('我要准备考试')
      expect(examTask.taskType).toBe('exam_prep')

      const assignmentTask = await extractor.extractTask('我要完成作业')
      expect(assignmentTask.taskType).toBe('assignment')

      const projectTask = await extractor.extractTask('我要做项目设计')
      expect(projectTask.taskType).toBe('project')

      const studyTask = await extractor.extractTask('我要学习英语')
      expect(studyTask.taskType).toBe('study')
    })

    it('应该返回估算时长', async () => {
      const extractor = new TaskExtractor()

      const highUrgency = await extractor.extractTask('今天要完成作业')
      expect(highUrgency.estimatedDuration).toBe('1-2小时')

      const mediumUrgency = await extractor.extractTask('这周要完成作业')
      expect(mediumUrgency.estimatedDuration).toBe('2-4小时')

      const lowUrgency = await extractor.extractTask('有时间完成作业')
      expect(lowUrgency.estimatedDuration).toBe('灵活安排')
    })

    it('应该返回任务描述', async () => {
      const extractor = new TaskExtractor()
      const result = await extractor.extractTask('我要完成数学作业')

      expect(result.taskDescription).toBeDefined()
    })

    it('应该返回需求列表', async () => {
      const extractor = new TaskExtractor()
      const result = await extractor.extractTask('我要完成作业')

      expect(result.requirements).toBeDefined()
      expect(result.requirements?.length).toBeGreaterThan(0)
    })
  })
})
