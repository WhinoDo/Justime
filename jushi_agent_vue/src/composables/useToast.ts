import { ref } from 'vue'
import type { ToastMessage } from '@/types/admin'

const toasts = ref<ToastMessage[]>([])

export function useToast() {
  const show = (toast: ToastMessage) => {
    toasts.value.push(toast)
    setTimeout(() => {
      toasts.value.shift()
    }, 5000)
  }

  const success = (title: string, description?: string) => {
    show({
      title,
      description,
      variant: 'default',
      className: 'bg-green-50 border-green-200 text-green-800'
    })
  }

  const error = (title: string, description?: string) => {
    show({
      title,
      description,
      variant: 'destructive'
    })
  }

  return {
    toasts,
    show,
    success,
    error
  }
}
