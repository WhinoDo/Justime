import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { TypewriterMessage } from '@/components/chat/TypewriterMessage'
import type { Message } from '@/types'

jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark' }),
}))

function buildMessage(partial: Partial<Message>): Message {
  return {
    id: 'msg-1',
    user_id: 'user-1',
    role: 'assistant',
    content: '',
    created_at: '2024-01-01T00:00:00Z',
    ...partial,
  }
}

describe('TypewriterMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders static content when not streaming', () => {
    render(
      <TypewriterMessage
        content="Hello World"
        isStreaming={false}
        message={buildMessage({ content: 'Hello World' })}
        instant
      />,
    )

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('shows cursor block when streaming', () => {
    const { container } = render(
      <TypewriterMessage
        content="Hello"
        isStreaming
        message={buildMessage({ content: 'Hello' })}
      />,
    )

    expect(container.querySelector('.bg-emerald-300')).toBeInTheDocument()
  })

  it('renders user message content', () => {
    render(
      <TypewriterMessage
        content="User message"
        isStreaming={false}
        message={buildMessage({ role: 'user', content: 'User message' })}
        instant
      />,
    )

    expect(screen.getByText('User message')).toBeInTheDocument()
  })

  it('handles document references click', () => {
    const mockReferenceClick = jest.fn()
    const ragReferences = [
      {
        referenceId: 'ref1',
        docPath: '/docs/test.md',
        fileName: 'test.md',
        score: 0.9,
        snippets: ['snippet 1'],
        queries: ['query 1'],
      },
    ]

    render(
      <TypewriterMessage
        content="Response with references"
        isStreaming={false}
        message={buildMessage({ content: 'Response with references', ragReferences })}
        onReferenceClick={mockReferenceClick}
        instant
      />,
    )

    const refButton = screen.getByRole('button', { name: /test.md/i })
    fireEvent.click(refButton)
    expect(mockReferenceClick).toHaveBeenCalledWith(ragReferences[0])
  })

  it('animates content with typewriter effect', async () => {
    jest.useFakeTimers()

    render(
      <TypewriterMessage
        content="Hello World"
        isStreaming
        message={buildMessage({ content: '' })}
        speed={10}
      />,
    )

    act(() => {
      jest.advanceTimersByTime(200)
    })

    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })

    jest.useRealTimers()
  })
})
