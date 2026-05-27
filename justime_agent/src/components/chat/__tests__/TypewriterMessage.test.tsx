import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TypewriterMessage } from '@/components/chat/TypewriterMessage'

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark' }),
}))

describe('TypewriterMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders static content when not streaming', async () => {
    render(
      <TypewriterMessage
        content="Hello World"
        isStreaming={false}
        message={{ role: 'assistant', content: 'Hello World' }}
        instant={true}
      />
    )

    // Content should be rendered immediately
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })

  it('shows cursor when streaming', () => {
    render(
      <TypewriterMessage
        content="Hello"
        isStreaming={true}
        message={{ role: 'assistant', content: 'Hello' }}
        showCursor={true}
      />
    )

    // Should show the cursor character
    expect(screen.getByText('|')).toBeInTheDocument()
  })

  it('renders user message with correct styling', () => {
    render(
      <TypewriterMessage
        content="User message"
        isStreaming={false}
        message={{ role: 'user', content: 'User message' }}
        instant={true}
      />
    )

    // User avatar should be present
    expect(screen.getByText('User message')).toBeInTheDocument()
  })

  it('renders assistant message with correct styling', () => {
    render(
      <TypewriterMessage
        content="Assistant response"
        isStreaming={false}
        message={{ role: 'assistant', content: 'Assistant response' }}
        instant={true}
      />
    )

    // Content should be present
    expect(screen.getByText('Assistant response')).toBeInTheDocument()
  })

  it('handles RAG references click', async () => {
    const mockReferenceClick = vi.fn()
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
        message={{
          role: 'assistant',
          content: 'Response with references',
          ragReferences,
        }}
        onReferenceClick={mockReferenceClick}
        instant={true}
      />
    )

    // Reference button should be present
    const refButton = screen.getByRole('button', { name: /test.md/i })
    expect(refButton).toBeInTheDocument()

    // Click should trigger callback
    fireEvent.click(refButton)
    expect(mockReferenceClick).toHaveBeenCalledWith(ragReferences[0])
  })

  it('animates content with typewriter effect', async () => {
    vi.useFakeTimers()

    render(
      <TypewriterMessage
        content="Hello World"
        isStreaming={true}
        message={{ role: 'assistant', content: '' }}
        typewriterSpeed={10}
      />
    )

    // Initially, only first character should appear
    await waitFor(() => {
      expect(screen.getByText(/H/)).toBeInTheDocument()
    })

    // Advance timers to complete animation
    vi.advanceTimersByTime(200)

    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })

    vi.useRealTimers()
  })
})