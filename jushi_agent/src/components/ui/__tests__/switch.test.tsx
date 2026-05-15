import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from '../switch'

describe('Switch', () => {
  it('应该渲染开关组件', () => {
    render(<Switch data-testid="switch" />)

    expect(screen.getByTestId('switch')).toBeInTheDocument()
  })

  it('应该支持默认选中', () => {
    render(<Switch defaultChecked data-testid="switch" />)

    expect(screen.getByTestId('switch')).toHaveAttribute('data-state', 'checked')
  })

  it('点击应该切换状态', async () => {
    const user = userEvent.setup()
    render(<Switch data-testid="switch" />)

    const switchEl = screen.getByTestId('switch')
    expect(switchEl).toHaveAttribute('data-state', 'unchecked')

    await user.click(switchEl)

    expect(switchEl).toHaveAttribute('data-state', 'checked')
  })

  it('禁用时应该不可点击', async () => {
    const user = userEvent.setup()
    render(<Switch disabled data-testid="switch" />)

    const switchEl = screen.getByTestId('switch')
    expect(switchEl).toBeDisabled()
  })

  it('应该支持自定义 className', () => {
    render(<Switch className="custom-class" data-testid="switch" />)

    expect(screen.getByTestId('switch')).toHaveClass('custom-class')
  })
})
