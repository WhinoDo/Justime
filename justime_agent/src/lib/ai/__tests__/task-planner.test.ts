import { TaskPlanner, TaskItem } from '../task-planner'

describe('TaskPlanner', () => {
  describe('analyzeMessage', () => {
    it('应该检测包含计划关键词的消息', () => {
      expect(TaskPlanner.analyzeMessage('帮我制定一个学习计划')).toBe(true)
      expect(TaskPlanner.analyzeMessage('今天有什么安排')).toBe(true)
      expect(TaskPlanner.analyzeMessage('明天的日程是什么')).toBe(true)
    })

    it('应该检测包含时间关键词的消息', () => {
      expect(TaskPlanner.analyzeMessage('明天早上几点')).toBe(true)
      expect(TaskPlanner.analyzeMessage('下午三点有个会议')).toBe(true)
      expect(TaskPlanner.analyzeMessage('周一开会')).toBe(true)
    })

    it('应该检测包含时间格式的消息', () => {
      expect(TaskPlanner.analyzeMessage('9:30开会')).toBe(true)
      expect(TaskPlanner.analyzeMessage('下午3点')).toBe(true)
      expect(TaskPlanner.analyzeMessage('3月15日')).toBe(true)
    })

    it('不包含任务关键词的消息应返回 false', () => {
      expect(TaskPlanner.analyzeMessage('你好')).toBe(false)
      expect(TaskPlanner.analyzeMessage('天气怎么样')).toBe(false)
      expect(TaskPlanner.analyzeMessage('随便聊聊')).toBe(false)
    })
  })

  describe('generateTaskPrompt', () => {
    it('应该生成包含用户消息的提示词', () => {
      const prompt = TaskPlanner.generateTaskPrompt('帮我规划明天的学习')
      expect(prompt).toContain('帮我规划明天的学习')
      expect(prompt).toContain('聚时')
    })

    it('应该包含时间上下文', () => {
      const prompt = TaskPlanner.generateTaskPrompt('测试', '当前时间: 2025-01-01 10:00')
      expect(prompt).toContain('当前时间: 2025-01-01 10:00')
    })

    it('应该包含情绪信息', () => {
      const prompt = TaskPlanner.generateTaskPrompt('测试', undefined, 8, ['开心', '兴奋'])
      expect(prompt).toContain('8/10')
      expect(prompt).toContain('开心、兴奋')
    })
  })

  describe('parseTaskResponse', () => {
    it('应该解析包含JSON的AI回复', () => {
      const aiResponse = `
## 任务计划
这是一个计划

## 结构化数据
\`\`\`json
{
  "hasTasks": true,
  "tasks": [
    {
      "id": "task_1",
      "title": "学习英语",
      "startTime": "2025-01-01T09:00:00.000Z",
      "endTime": "2025-01-01T10:00:00.000Z",
      "priority": "medium"
    }
  ]
}
\`\`\`
`
      const result = TaskPlanner.parseTaskResponse(aiResponse)

      expect(result.hasTasks).toBe(true)
      expect(result.tasks).toHaveLength(1)
      expect(result.tasks[0].title).toBe('学习英语')
    })

    it('没有JSON时应返回原始文本', () => {
      const aiResponse = '这是一个普通回复，没有结构化数据'
      const result = TaskPlanner.parseTaskResponse(aiResponse)

      expect(result.hasTasks).toBe(false)
      expect(result.tasks).toHaveLength(0)
      expect(result.planText).toBe(aiResponse)
    })

    it('JSON解析失败时应返回原始文本', () => {
      const aiResponse = `
\`\`\`json
{ invalid json }
\`\`\`
`
      const result = TaskPlanner.parseTaskResponse(aiResponse)

      expect(result.hasTasks).toBe(false)
      expect(result.tasks).toHaveLength(0)
    })

    it('应该正确提取计划文本', () => {
      const aiResponse = `
## 情绪支持
加油！

## 任务计划
明天早上学习

## 结构化数据
\`\`\`json
{"hasTasks": true, "tasks": []}
\`\`\`
`
      const result = TaskPlanner.parseTaskResponse(aiResponse)

      expect(result.planText).toContain('情绪支持')
      expect(result.planText).toContain('任务计划')
    })
  })

  describe('validateTask', () => {
    const validTask: TaskItem = {
      id: 'task_1',
      title: '学习',
      startTime: '2025-01-01T09:00:00.000Z',
      endTime: '2025-01-01T10:00:00.000Z',
      priority: 'medium',
    }

    it('应该验证有效的任务', () => {
      expect(TaskPlanner.validateTask(validTask)).toBe(true)
    })

    it('缺少ID时应返回false', () => {
      const task = { ...validTask, id: '' }
      expect(TaskPlanner.validateTask(task)).toBe(false)
    })

    it('缺少标题时应返回false', () => {
      const task = { ...validTask, title: '' }
      expect(TaskPlanner.validateTask(task)).toBe(false)
    })

    it('无效的开始时间应返回false', () => {
      const task = { ...validTask, startTime: 'invalid' }
      expect(TaskPlanner.validateTask(task)).toBe(false)
    })

    it('无效的结束时间应返回false', () => {
      const task = { ...validTask, endTime: 'invalid' }
      expect(TaskPlanner.validateTask(task)).toBe(false)
    })

    it('开始时间晚于结束时间应返回false', () => {
      const task = { ...validTask, startTime: '2025-01-01T10:00:00.000Z', endTime: '2025-01-01T09:00:00.000Z' }
      expect(TaskPlanner.validateTask(task)).toBe(false)
    })
  })

  describe('generateDefaultTime', () => {
    it('应该生成默认的时间', () => {
      const { startTime, endTime } = TaskPlanner.generateDefaultTime({})

      expect(new Date(startTime).getHours()).toBe(9)
      expect(new Date(endTime).getTime() - new Date(startTime).getTime()).toBe(60 * 60 * 1000)
    })
  })

  describe('convertToFeishuEvent', () => {
    it('应该转换为飞书日程格式', () => {
      const task: TaskItem = {
        id: 'task_1',
        title: '会议',
        description: '项目讨论',
        startTime: '2025-01-01T09:00:00.000Z',
        endTime: '2025-01-01T10:00:00.000Z',
        priority: 'high',
        location: '会议室A',
        reminders: [15, 5],
      }

      const event = TaskPlanner.convertToFeishuEvent(task)

      expect(event.title).toBe('会议')
      expect(event.description).toBe('项目讨论')
      expect(event.start_time).toBe('2025-01-01T09:00:00.000Z')
      expect(event.end_time).toBe('2025-01-01T10:00:00.000Z')
      expect(event.location).toBe('会议室A')
      expect(event.need_notification).toBe(true)
      expect(event.reminders).toHaveLength(2)
    })

    it('没有提醒时 should_notification 为 undefined', () => {
      const task: TaskItem = {
        id: 'task_1',
        title: '会议',
        startTime: '2025-01-01T09:00:00.000Z',
        endTime: '2025-01-01T10:00:00.000Z',
        priority: 'medium',
      }

      const event = TaskPlanner.convertToFeishuEvent(task)
      expect(event.need_notification).toBeFalsy()
    })
  })
})
