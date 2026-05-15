import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScrollArea, ScrollBar } from '../scroll-area'

describe('ScrollArea', () => {
  it('应该渲染子组件', () => {
    render(
      <ScrollArea data-testid="scroll-area">
        <div>内容</div>
      </ScrollArea>
    )

    expect(screen.getByText('内容')).toBeInTheDocument()
  })

  it('应该支持自定义 className', () => {
    render(
      <ScrollArea className="custom-class" data-testid="scroll-area">
        <div>内容</div>
      </ScrollArea>
    )

    expect(screen.getByTestId('scroll-area')).toHaveClass('custom-class')
  })
})

describe('ScrollBar', () => {
  it('应该渲染垂直滚动条', () => {
    render(
      <ScrollArea>
        <div>内容</div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    )

    expect(screen.getByText('内容')).toBeInTheDocument()
  })

  it('应该渲染水平滚动条', () => {
    render(
      <ScrollArea>
        <div>内容</div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    )

    expect(screen.getByText('内容')).toBeInTheDocument()
  })
})
