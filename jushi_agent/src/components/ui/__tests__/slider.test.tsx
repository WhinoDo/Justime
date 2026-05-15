import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Slider } from '../slider'

describe('Slider', () => {
  it('应该渲染滑块组件', () => {
    render(<Slider data-testid="slider" />)

    expect(screen.getByTestId('slider')).toBeInTheDocument()
  })

  it('应该支持默认值', () => {
    render(<Slider defaultValue={[50]} data-testid="slider" />)

    expect(screen.getByTestId('slider')).toBeInTheDocument()
  })

  it('应该支持范围值', () => {
    render(<Slider defaultValue={[25, 75]} data-testid="slider" />)

    expect(screen.getByTestId('slider')).toBeInTheDocument()
  })

  it('禁用时应该不可操作', () => {
    render(<Slider disabled data-testid="slider" />)

    expect(screen.getByTestId('slider')).toHaveAttribute('data-disabled')
  })

  it('应该支持自定义 className', () => {
    render(<Slider className="custom-class" data-testid="slider" />)

    expect(screen.getByTestId('slider')).toHaveClass('custom-class')
  })

  it('应该支持最小和最大值', () => {
    render(<Slider min={0} max={100} defaultValue={[50]} data-testid="slider" />)

    expect(screen.getByTestId('slider')).toBeInTheDocument()
  })

  it('应该支持步进值', () => {
    render(<Slider step={10} defaultValue={[50]} data-testid="slider" />)

    expect(screen.getByTestId('slider')).toBeInTheDocument()
  })
})
