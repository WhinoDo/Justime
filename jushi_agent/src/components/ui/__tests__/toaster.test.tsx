import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { Toaster } from '../toaster'
import { toast } from '../use-toast'

jest.mock('../use-toast', () => {
  const actualModule = jest.requireActual('../use-toast')
  return {
    ...actualModule,
    useToast: () => ({
      toasts: [],
      toast: actualModule.toast,
      dismiss: jest.fn(),
    }),
  }
})

describe('Toaster', () => {
  it('应该渲染 ToastProvider', () => {
    const { container } = render(<Toaster />)
    expect(container.firstChild).toBeInTheDocument()
  })

  it('没有 toast 时应该渲染空列表', () => {
    const { container } = render(<Toaster />)
    expect(container.querySelectorAll('[data-radix-toast-root]')).toHaveLength(0)
  })
})
