import React from 'react'
import { render, screen } from '@testing-library/react'
import { MessageList, MessageListProps } from '../MessageList'

jest.mock('next/dynamic', () => () => {
  const MockMessageBubble = ({ message }: { message: { content: string } }) => (
    <div data-testid="message-bubble">{message.content}</div>
  )
  return MockMessageBubble
})

jest.mock('../TaskSelector', () => ({
  TaskSelector: () => <div data-testid="task-selector" />,
}))

jest.mock('../SuggestedEventCard', () => ({
  SuggestedEventCard: () => <div data-testid="suggested-event-card" />,
}))

jest.mock('../EditableTaskPlan', () => ({
  EditableTaskPlan: () => <div data-testid="editable-task-plan" />,
}))

jest.mock('../ThinkingLoader', () => ({
  ThinkingLoader: () => <div data-testid="thinking-loader" />,
}))

jest.mock('../TypewriterMessage', () => ({
  TypewriterMessage: () => <div data-testid="typewriter-message" />,
}))

const baseProps: MessageListProps = {
  messages: [],
  isLoading: false,
  streamingMessage: null,
  streamingContent: '',
  onReferenceClick: jest.fn(),
  pendingTasks: [],
  taskMessageId: null,
  onTaskAdded: jest.fn(),
  onConfirmEvent: jest.fn(),
  onDismissEvent: jest.fn(),
  taskDecomposition: null,
  decompositionMessageId: null,
  multiTaskDecompositions: null,
  expandedDecompositionId: null,
  onConfirmDecomposition: jest.fn(),
  onExpandDecomposition: jest.fn(),
  onCancelDecomposition: jest.fn(),
}

describe('MessageList layout contracts', () => {
  it('empty state container has overflow-y-auto for local scroll', () => {
    const { container } = render(<MessageList {...baseProps} />)

    const scrollContainer = container.querySelector('.overflow-y-auto')
    expect(scrollContainer).toBeTruthy()
    expect(scrollContainer!.className).toContain('overflow-y-auto')
    expect(scrollContainer!.className).toContain('flex-1')
  })

  it('message list container has overflow-y-auto for local scroll', () => {
    const props = {
      ...baseProps,
      messages: [
        { id: '1', user_id: 'u1', role: 'user' as const, content: 'Hello', created_at: '2024-01-01' },
      ],
    }
    const { container } = render(<MessageList {...props} />)

    const scrollContainer = container.querySelector('.overflow-y-auto')
    expect(scrollContainer).toBeTruthy()
    expect(scrollContainer!.className).toContain('overflow-y-auto')
    expect(scrollContainer!.className).toContain('flex-1')
  })

  it('does not cause document-level scroll (no min-h-screen on root)', () => {
    const { container } = render(<MessageList {...baseProps} />)

    const root = container.firstElementChild as HTMLElement
    expect(root.className).not.toContain('min-h-screen')
    expect(root.className).not.toContain('h-screen')
  })
})
