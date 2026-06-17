import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChatContextInspector } from '../ChatContextInspector'

describe('ChatContextInspector', () => {
  it('renders task and model context', () => {
    render(
      <ChatContextInspector
        currentTaskLabel="macOS 桌面端优化"
        selectedModel="deepseek-chat"
      />,
    )

    expect(screen.getByText('上下文检查器')).toBeInTheDocument()
    expect(screen.getByText('macOS 桌面端优化')).toBeInTheDocument()
    expect(screen.getByText('deepseek-chat')).toBeInTheDocument()
    expect(screen.getByText(/点击回答中的 RAG 引用/)).toBeInTheDocument()
  })
})
