import { EmotionAnalyzer } from '../emotion-analyzer'
import { EmotionAnalysis } from '@/types'

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  }
})

import { OpenAI } from 'openai'

describe('EmotionAnalyzer', () => {
  let analyzer: EmotionAnalyzer
  const mockOpenAI = OpenAI as jest.MockedClass<typeof OpenAI>

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SILICONFLOW_API_KEY = 'real-api-key-for-testing'
  })

  afterEach(() => {
    delete process.env.SILICONFLOW_API_KEY
  })

  describe('analyzeEmotion', () => {
    it('应该分析用户文本并返回情绪评分', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 3,
              tags: ['焦虑', '自我怀疑'],
              reasoning: '用户表现出明显的焦虑情绪和对自己能力的怀疑'
            })
          }
        }]
      })

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any))

      analyzer = new EmotionAnalyzer()
      const result = await analyzer.analyzeEmotion('我觉得这个任务太难了，我可能做不好')

      expect(result.score).toBe(3)
      expect(result.tags).toEqual(['焦虑', '自我怀疑'])
      expect(result.reasoning).toBe('用户表现出明显的焦虑情绪和对自己能力的怀疑')
    })

    it('应该处理API返回的无效JSON格式', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: '这不是有效的JSON格式'
          }
        }]
      })

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any))

      analyzer = new EmotionAnalyzer()
      const result = await analyzer.analyzeEmotion('测试文本')

      expect(result.tags).toContain('需要关注')
    })

    it('应该处理API调用失败的情况', async () => {
      const mockCreate = jest.fn().mockRejectedValue(new Error('API调用失败'))

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any))

      analyzer = new EmotionAnalyzer()
      const result = await analyzer.analyzeEmotion('测试文本')

      expect(result).toBeDefined()
      expect(result.score).toBeGreaterThanOrEqual(1)
      expect(result.score).toBeLessThanOrEqual(10)
    })

    it('应该使用正确的API端点和参数', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 7,
              tags: ['积极'],
              reasoning: '用户情绪积极'
            })
          }
        }]
      })

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any))

      analyzer = new EmotionAnalyzer()
      await analyzer.analyzeEmotion('我今天感觉很好')

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'Qwen/Qwen2.5-72B-Instruct',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
            }),
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('我今天感觉很好'),
            }),
          ]),
        })
      )
    })
  })

  describe('suggestEmotionScore', () => {
    it('应该基于分析结果建议情绪评分', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 6,
              tags: ['轻微焦虑'],
              reasoning: '用户有轻微担忧'
            })
          }
        }]
      })

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any))

      analyzer = new EmotionAnalyzer()
      const score = await analyzer.suggestEmotionScore('我有点担心明天的考试')

      expect(score).toBe(6)
    })
  })

  describe('情绪评分边界测试', () => {
    it('应该为"我完全无法动手做这件事"返回合理的评分', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 2,
              tags: ['重度焦虑'],
              reasoning: '用户表现出严重的无力感'
            })
          }
        }]
      })

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any))

      analyzer = new EmotionAnalyzer()
      const result = await analyzer.analyzeEmotion('我完全无法动手做这件事')

      expect(result.score).toBeGreaterThanOrEqual(1)
      expect(result.score).toBeLessThanOrEqual(10)
    })

    it('应该为"我很清楚自己要做什么"返回合理的评分', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify({
              score: 8,
              tags: ['积极'],
              reasoning: '用户状态良好'
            })
          }
        }]
      })

      mockOpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate,
          },
        },
      } as any))

      analyzer = new EmotionAnalyzer()
      const result = await analyzer.analyzeEmotion('我很清楚自己要做什么')

      expect(result.score).toBeGreaterThanOrEqual(1)
      expect(result.score).toBeLessThanOrEqual(10)
    })
  })

  describe('无API密钥时的模拟数据', () => {
    it('应该在无API密钥时返回模拟结果', async () => {
      delete process.env.SILICONFLOW_API_KEY
      analyzer = new EmotionAnalyzer()
      
      const result = await analyzer.analyzeEmotion('我很开心')

      expect(result).toBeDefined()
      expect(result.score).toBeGreaterThanOrEqual(1)
      expect(result.score).toBeLessThanOrEqual(10)
      expect(result.tags).toBeDefined()
      expect(result.reasoning).toBe('基于文本关键词分析')
    })
  })
})
