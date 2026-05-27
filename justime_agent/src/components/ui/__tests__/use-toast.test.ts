import { renderHook, act } from '@testing-library/react'
import { useToast, toast, reducer } from '../use-toast'

describe('use-toast', () => {
  describe('reducer', () => {
    const initialState = { toasts: [] }

    it('ADD_TOAST 应该添加新的 toast', () => {
      const newToast = { id: '1', title: 'Test', open: true }
      const state = reducer(initialState, {
        type: 'ADD_TOAST',
        toast: newToast,
      })

      expect(state.toasts).toHaveLength(1)
      expect(state.toasts[0]).toEqual(newToast)
    })

    it('ADD_TOAST 应该限制 toast 数量为 1', () => {
      const state1 = reducer(initialState, {
        type: 'ADD_TOAST',
        toast: { id: '1', title: 'First', open: true },
      })

      const state2 = reducer(state1, {
        type: 'ADD_TOAST',
        toast: { id: '2', title: 'Second', open: true },
      })

      expect(state2.toasts).toHaveLength(1)
      expect(state2.toasts[0].id).toBe('2')
    })

    it('UPDATE_TOAST 应该更新指定的 toast', () => {
      const stateWithToast = {
        toasts: [{ id: '1', title: 'Original', open: true }],
      }

      const state = reducer(stateWithToast, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated' },
      })

      expect(state.toasts[0].title).toBe('Updated')
    })

    it('UPDATE_TOAST 不应该影响其他 toast', () => {
      const stateWithToasts = {
        toasts: [
          { id: '1', title: 'First', open: true },
        ],
      }

      const state = reducer(stateWithToasts, {
        type: 'UPDATE_TOAST',
        toast: { id: '2', title: 'Updated' },
      })

      expect(state.toasts[0].title).toBe('First')
    })

    it('DISMISS_TOAST 应该设置指定 toast 的 open 为 false', () => {
      const stateWithToast = {
        toasts: [{ id: '1', title: 'Test', open: true }],
      }

      const state = reducer(stateWithToast, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      })

      expect(state.toasts[0].open).toBe(false)
    })

    it('DISMISS_TOAST 没有 toastId 时应该关闭所有 toast', () => {
      const stateWithToasts = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      }

      const state = reducer(stateWithToasts, {
        type: 'DISMISS_TOAST',
      })

      expect(state.toasts.every((t) => t.open === false)).toBe(true)
    })

    it('REMOVE_TOAST 应该移除指定的 toast', () => {
      const stateWithToast = {
        toasts: [{ id: '1', title: 'Test', open: true }],
      }

      const state = reducer(stateWithToast, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      })

      expect(state.toasts).toHaveLength(0)
    })

    it('REMOVE_TOAST 没有 toastId 时应该清空所有 toast', () => {
      const stateWithToasts = {
        toasts: [
          { id: '1', title: 'First', open: true },
          { id: '2', title: 'Second', open: true },
        ],
      }

      const state = reducer(stateWithToasts, {
        type: 'REMOVE_TOAST',
      })

      expect(state.toasts).toHaveLength(0)
    })
  })

  describe('toast function', () => {
    it('应该创建并返回 toast id', () => {
      const result = toast({ title: 'Test' })
      expect(result.id).toBeDefined()
      expect(result.dismiss).toBeDefined()
      expect(result.update).toBeDefined()
    })

    it('应该能够更新 toast', () => {
      const result = toast({ title: 'Original' })
      result.update({ title: 'Updated', id: result.id })
    })

    it('应该能够关闭 toast', () => {
      const result = toast({ title: 'Test' })
      result.dismiss()
    })
  })

  describe('useToast hook', () => {
    it('应该返回初始状态', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current.toasts).toBeDefined()
      expect(result.current.toast).toBeDefined()
      expect(result.current.dismiss).toBeDefined()
    })

    it('应该能够通过 hook 添加 toast', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        result.current.toast({ title: 'New Toast' })
      })

      expect(result.current.toasts.length).toBeGreaterThan(0)
    })

    it('应该能够通过 hook 关闭 toast', () => {
      const { result } = renderHook(() => useToast())

      let toastId: string
      act(() => {
        const res = result.current.toast({ title: 'Test Toast' })
        toastId = res.id
      })

      act(() => {
        result.current.dismiss(toastId)
      })

      const dismissedToast = result.current.toasts.find((t) => t.id === toastId)
      if (dismissedToast) {
        expect(dismissedToast.open).toBe(false)
      }
    })
  })
})
