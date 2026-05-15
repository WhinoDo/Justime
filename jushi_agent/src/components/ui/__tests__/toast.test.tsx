import React from 'react'
import { render, screen } from '@testing-library/react'
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastTitle,
  ToastDescription,
  ToastProvider,
  ToastViewport,
} from '../toast'

describe('Toast Components', () => {
  it('Toast 应该渲染子组件', () => {
    render(
      <ToastProvider>
        <Toast open data-state="open">
          <ToastTitle>标题</ToastTitle>
          <ToastDescription>描述</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    expect(screen.getByText('标题')).toBeInTheDocument()
    expect(screen.getByText('描述')).toBeInTheDocument()
  })

  it('Toast 应该支持 destructive variant', () => {
    render(
      <ToastProvider>
        <Toast variant="destructive" open data-state="open">
          <ToastTitle>错误</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    expect(screen.getByText('错误')).toBeInTheDocument()
  })

  it('ToastAction 应该渲染按钮', () => {
    render(
      <ToastProvider>
        <Toast open data-state="open">
          <ToastTitle>标题</ToastTitle>
          <ToastAction altText="重试">重试</ToastAction>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    expect(screen.getByText('重试')).toBeInTheDocument()
  })

  it('ToastClose 应该渲染关闭按钮', () => {
    render(
      <ToastProvider>
        <Toast open data-state="open">
          <ToastTitle>标题</ToastTitle>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    expect(document.querySelector('[toast-close]')).toBeInTheDocument()
  })

  it('ToastTitle 应该渲染标题', () => {
    render(
      <ToastProvider>
        <Toast open data-state="open">
          <ToastTitle>Toast 标题</ToastTitle>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    expect(screen.getByText('Toast 标题')).toBeInTheDocument()
  })

  it('ToastDescription 应该渲染描述', () => {
    render(
      <ToastProvider>
        <Toast open data-state="open">
          <ToastDescription>Toast 描述</ToastDescription>
        </Toast>
        <ToastViewport />
      </ToastProvider>
    )

    expect(screen.getByText('Toast 描述')).toBeInTheDocument()
  })

  it('ToastViewport 应该渲染', () => {
    const { container } = render(
      <ToastProvider>
        <ToastViewport />
      </ToastProvider>
    )

    expect(container.querySelector('ol')).toBeInTheDocument()
  })
})
