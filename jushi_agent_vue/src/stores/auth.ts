import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SafeUser } from '@/types/admin'
import { API_ENDPOINTS } from '@/api/endpoints'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SafeUser | null>(null)
  const isLoading = ref(true)
  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  const clearAuthState = () => {
    user.value = null
    isLoading.value = false
  }

  const setAuthenticated = (userData: SafeUser) => {
    user.value = userData
    isLoading.value = false
  }

  const checkAuth = async () => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.ME, {
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data?.user) {
          setAuthenticated(data.data.user)
          return data.data.user
        }
      }

      if (response.status === 401) {
        const refreshResponse = await fetch(API_ENDPOINTS.AUTH.REFRESH, {
          method: 'POST',
          credentials: 'include'
        })

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json()
          if (refreshData.success && refreshData.data?.user) {
            setAuthenticated(refreshData.data.user)
            return refreshData.data.user
          }
        }

        clearAuthState()
        return null
      }

      clearAuthState()
      return null

    } catch (error) {
      console.error('检查认证状态失败:', error)
      clearAuthState()
      return null
    }
  }

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.AUTH.LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      })

      const result = await response.json()

      if (result.success && result.data) {
        setAuthenticated(result.data.user)
        return { success: true, user: result.data.user }
      } else {
        return { success: false, error: result.message || result.error || '登录失败' }
      }
    } catch (error) {
      console.error('登录失败:', error)
      return { success: false, error: '登录时发生错误' }
    }
  }

  const logout = async () => {
    try {
      await fetch(API_ENDPOINTS.AUTH.LOGOUT, {
        method: 'POST',
        credentials: 'include'
      })

      clearAuthState()
      return { success: true }
    } catch (error) {
      console.error('登出失败:', error)
      return { success: false, error: '登出时发生错误' }
    }
  }

  const updateUser = (updatedUser: Partial<SafeUser>) => {
    if (user.value) {
      user.value = { ...user.value, ...updatedUser }
    }
  }

  return {
    user,
    isLoading,
    isAuthenticated,
    isAdmin,
    checkAuth,
    login,
    logout,
    updateUser,
    clearAuthState,
    setAuthenticated
  }
})
