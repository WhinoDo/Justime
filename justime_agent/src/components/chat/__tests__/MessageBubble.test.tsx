import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageBubble } from '../MessageBubble'
import { Message } from '@/types'

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark' }),
}))

jest.mock('react-syntax-highlighter', () => ({
  Prism: ({ children }: any) => <pre>{children}</pre>,
}))

jest.mock('react-syntax-highlighter/dist/esm/styles/prism', () => ({
  oneDark: {},
  oneLight: {},
}))

jest.mock('react-markdown', () => {
  const MockMarkdown = ({ children }: any) => <div>{children}</div>
  MockMarkdown.displayName = 'MockMarkdown'
  return MockMarkdown
})

jest.mock('remark-gfm', () => () => {})

describe('MessageBubble', () => {
  const baseUserMessage: Message = {
    id: '1',
    user_id: 'user1',
    role: 'user',
    content: '我需要写一份报告',
    created_at: '2024-01-01T10:00:00Z',
  }

  const baseAssistantMessage: Message = {
    id: '2',
    user_id: 'assistant',
    role: 'assistant',
    content: '好的，让我帮你分析一下这个任务',
    created_at: '2024-01-01T10:01:00Z',
  }

  it('应该渲染用户消息', () => {
    render(<MessageBubble message={baseUserMessage} />)

    expect(screen.getByText('我需要写一份报告')).toBeInTheDocument()
  })

  it('应该渲染助手消息', () => {
    render(<MessageBubble message={baseAssistantMessage} />)

    expect(screen.getByText('好的，让我帮你分析一下这个任务')).toBeInTheDocument()
  })

  it('用户消息应该右对齐', () => {
    const { container } = render(<MessageBubble message={baseUserMessage} />)

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('ml-auto')
  })

  it('助手消息应该左对齐', () => {
    const { container } = render(<MessageBubble message={baseAssistantMessage} />)

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('mr-auto')
  })

  it('有任务分析元数据时应该显示标签', () => {
    const taskMessage: Message = {
      ...baseAssistantMessage,
      content: '这是思考任务的分析结果',
      taskAnalysis: {
        taskType: 'thinking',
        difficultyLevel: 4,
        urgency: 'high',
        confidence: 0.85,
      },
    }

    render(<MessageBubble message={taskMessage} />)

    expect(screen.getByText('思考任务')).toBeInTheDocument()
    expect(screen.getByText('难度 4')).toBeInTheDocument()
    expect(screen.getByText('高紧急')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
  })

  it('通用任务不应该显示任务分析标签', () => {
    const generalMessage: Message = {
      ...baseAssistantMessage,
      content: '普通对话内容',
      taskAnalysis: {
        taskType: 'general',
        difficultyLevel: 1,
        urgency: 'low',
      },
    }

    render(<MessageBubble message={generalMessage} />)

    expect(screen.queryByText('通用任务')).not.toBeInTheDocument()
  })

  it('背诵任务应该正确显示', () => {
    const recitationMessage: Message = {
      ...baseAssistantMessage,
      content: '这是背诵任务',
      taskAnalysis: {
        taskType: 'recitation',
        difficultyLevel: 3,
        urgency: 'medium',
      },
    }

    render(<MessageBubble message={recitationMessage} />)

    expect(screen.getByText('背诵任务')).toBeInTheDocument()
    expect(screen.getByText('中紧急')).toBeInTheDocument()
  })

  it('低紧急应该正确显示', () => {
    const lowUrgencyMessage: Message = {
      ...baseAssistantMessage,
      content: '低紧急任务',
      taskAnalysis: {
        taskType: 'thinking',
        difficultyLevel: 2,
        urgency: 'low',
      },
    }

    render(<MessageBubble message={lowUrgencyMessage} />)

    expect(screen.getByText('低紧急')).toBeInTheDocument()
  })

  describe('文档引用', () => {
    it('有引用时应该显示引用区域', () => {
      const refMessage: Message = {
        ...baseAssistantMessage,
        content: '根据文档分析',
        ragReferences: [
          {
            referenceId: 'ref1',
            docPath: '/docs/guide.md',
            fileName: 'guide.md',
            score: 0.95,
            snippets: ['段落1', '段落2'],
            queries: ['query1'],
          },
        ],
      }

      render(<MessageBubble message={refMessage} />)

      expect(screen.getByText('引用文档')).toBeInTheDocument()
      expect(screen.getByText('guide.md')).toBeInTheDocument()
      expect(screen.getByText('2 段')).toBeInTheDocument()
    })

    it('点击引用应该调用onReferenceClick', async () => {
      const user = userEvent.setup()
      const onReferenceClick = jest.fn()

      const reference = {
        referenceId: 'ref1',
        docPath: '/docs/guide.md',
        fileName: 'guide.md',
        score: 0.95,
        snippets: ['段落1'],
        queries: ['query1'],
      }

      const refMessage: Message = {
        ...baseAssistantMessage,
        content: '根据文档分析',
        ragReferences: [reference],
      }

      render(<MessageBubble message={refMessage} onReferenceClick={onReferenceClick} />)

      const refButton = screen.getByText('guide.md').closest('button')!
      await user.click(refButton)

      expect(onReferenceClick).toHaveBeenCalledWith(reference)
    })

    it('没有引用时不应该显示引用区域', () => {
      render(<MessageBubble message={baseAssistantMessage} />)

      expect(screen.queryByText('引用文档')).not.toBeInTheDocument()
    })

    it('用户消息不应该显示引用', () => {
      const userRefMessage: Message = {
        ...baseUserMessage,
        ragReferences: [
          {
            referenceId: 'ref1',
            docPath: '/docs/guide.md',
            fileName: 'guide.md',
            score: 0.95,
            snippets: ['段落1'],
            queries: ['query1'],
          },
        ],
      }

      render(<MessageBubble message={userRefMessage} />)

      expect(screen.queryByText('引用文档')).not.toBeInTheDocument()
    })
  })
})
