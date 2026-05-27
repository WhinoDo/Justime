import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ErrorBoundary, { withErrorBoundary } from '../ErrorBoundary'

describe('ErrorBoundary', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('正常情况下应该渲染子组件', () => {
    render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>
    )

    expect(screen.getByText('正常内容')).toBeInTheDocument()
  })

  it('子组件抛出错误时应该显示错误界面', () => {
    const ThrowingComponent = () => {
      throw new Error('测试错误')
    }

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('出错了')).toBeInTheDocument()
    expect(screen.getByText('测试错误')).toBeInTheDocument()
  })

  it('没有错误信息时应该显示默认错误文本', () => {
    const ThrowNoMessage = () => {
      throw new Error()
    }

    render(
      <ErrorBoundary>
        <ThrowNoMessage />
      </ErrorBoundary>
    )

    expect(screen.getByText('页面加载失败，请重试')).toBeInTheDocument()
  })

  it('提供自定义fallback时应该显示fallback', () => {
    const ThrowingComponent = () => {
      throw new Error('test')
    }

    render(
      <ErrorBoundary fallback={<div>自定义错误界面</div>}>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('自定义错误界面')).toBeInTheDocument()
    expect(screen.queryByText('出错了')).not.toBeInTheDocument()
  })

  it('应该调用onError回调', () => {
    const onError = jest.fn()
    const ThrowingComponent = () => {
      throw new Error('测试错误')
    }

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ componentStack: expect.any(String) })
    )
  })

  it('点击重试应该恢复子组件', async () => {
    const user = userEvent.setup()
    let shouldThrow = true

    const ConditionalThrow = () => {
      if (shouldThrow) {
        throw new Error('条件错误')
      }
      return <div>恢复的内容</div>
    }

    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>
    )

    expect(screen.getByText('出错了')).toBeInTheDocument()

    shouldThrow = false

    const retryButton = screen.getByText('重试')
    await user.click(retryButton)

    expect(screen.getByText('恢复的内容')).toBeInTheDocument()
  })

  it('重试后再次出错应该再次显示错误界面', async () => {
    const user = userEvent.setup()

    const ThrowAlways = () => {
      throw new Error('持续错误')
    }

    render(
      <ErrorBoundary>
        <ThrowAlways />
      </ErrorBoundary>
    )

    expect(screen.getByText('持续错误')).toBeInTheDocument()

    const retryButton = screen.getByText('重试')
    await user.click(retryButton)

    expect(screen.getByText('持续错误')).toBeInTheDocument()
    expect(screen.getByText('重试')).toBeInTheDocument()
  })
})

describe('withErrorBoundary', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    console.error = originalConsoleError
  })

  it('应该包装组件并正常渲染', () => {
    const MyComponent = () => <div>我的组件</div>
    const WrappedComponent = withErrorBoundary(MyComponent)

    render(<WrappedComponent />)

    expect(screen.getByText('我的组件')).toBeInTheDocument()
  })

  it('包装组件出错时应该显示默认错误界面', () => {
    const ThrowingComponent = () => {
      throw new Error('包装组件错误')
    }
    const WrappedComponent = withErrorBoundary(ThrowingComponent)

    render(<WrappedComponent />)

    expect(screen.getByText('出错了')).toBeInTheDocument()
    expect(screen.getByText('包装组件错误')).toBeInTheDocument()
  })

  it('包装组件出错时应该使用自定义fallback', () => {
    const ThrowingComponent = () => {
      throw new Error('包装组件错误')
    }
    const WrappedComponent = withErrorBoundary(
      ThrowingComponent,
      <div>自定义fallback</div>
    )

    render(<WrappedComponent />)

    expect(screen.getByText('自定义fallback')).toBeInTheDocument()
  })

  it('包装组件出错时应该调用onError', () => {
    const onError = jest.fn()
    const ThrowingComponent = () => {
      throw new Error('包装组件错误')
    }
    const WrappedComponent = withErrorBoundary(ThrowingComponent, undefined, onError)

    render(<WrappedComponent />)

    expect(onError).toHaveBeenCalled()
  })

  it('应该正确传递props', () => {
    const Greeting = ({ name }: { name: string }) => <div>Hello {name}</div>
    const WrappedGreeting = withErrorBoundary(Greeting)

    render(<WrappedGreeting name="World" />)

    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})
