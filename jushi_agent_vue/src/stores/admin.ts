import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User, AdminModel, AdminApiKey, AdminStats, ToastMessage } from '@/types/admin'
import { API_ENDPOINTS } from '@/api/endpoints'

export const useAdminStore = defineStore('admin', () => {
  // State
  const users = ref<User[]>([])
  const models = ref<AdminModel[]>([])
  const apiKeys = ref<AdminApiKey[]>([])
  const stats = ref<AdminStats | null>(null)

  const usersLoading = ref(false)
  const modelsLoading = ref(false)
  const apiKeysLoading = ref(false)
  const statsLoading = ref(false)

  const toasts = ref<ToastMessage[]>([])

  // Computed
  const sortedModels = computed(() => {
    return [...models.value].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
  })

  const sortedApiKeys = computed(() => {
    return [...apiKeys.value].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  })

  // Toast helpers
  const showToast = (toast: ToastMessage) => {
    toasts.value.push(toast)
    setTimeout(() => {
      toasts.value.shift()
    }, 5000)
  }

  const showError = (title: string, description?: string) => {
    showToast({ title, description, variant: 'destructive' })
  }

  const showSuccess = (title: string, description?: string) => {
    showToast({ title, description, variant: 'default', className: 'bg-green-50 border-green-200 text-green-800' })
  }

  // Users
  const fetchUsers = async () => {
    usersLoading.value = true
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.USERS, { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || result.message || '获取用户列表失败')
      }
      users.value = Array.isArray(result?.data) ? result.data : []
    } catch (error) {
      showError('获取用户列表失败', error instanceof Error ? error.message : '请检查网络连接或稍后重试')
    } finally {
      usersLoading.value = false
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.USER(userId), {
        method: 'DELETE',
        credentials: 'include'
      })
      const result = await response.json()
      if (response.ok) {
        showSuccess('用户删除成功')
        await fetchUsers()
        return true
      } else {
        showError('删除失败', result.error || result.message || '操作无法完成')
        return false
      }
    } catch (error) {
      showError('请求失败', '发生网络错误')
      return false
    }
  }

  const updateUserRole = async (userId: string, role: 'admin' | 'user') => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.USER_ROLE(userId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '更新角色失败')
      showSuccess('角色更新成功')
      await fetchUsers()
      return true
    } catch (error) {
      showError('更新角色失败', error instanceof Error ? error.message : '操作无法完成')
      return false
    }
  }

  const updateUserStatus = async (userId: string, status: 'active' | 'banned') => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.USER_STATUS(userId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '更新状态失败')
      showSuccess('状态更新成功')
      await fetchUsers()
      return true
    } catch (error) {
      showError('更新状态失败', error instanceof Error ? error.message : '操作无法完成')
      return false
    }
  }

  const updateUserModels = async (userId: string, accessAllModels: boolean, allowedModelIds: string[]) => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.USER_MODELS(userId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          access_all_models: accessAllModels,
          allowed_model_ids: allowedModelIds
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '更新用户模型权限失败')
      showSuccess('模型权限更新成功')
      await fetchUsers()
      return true
    } catch (error) {
      showError('保存失败', error instanceof Error ? error.message : '请稍后重试')
      return false
    }
  }

  // Models
  const fetchModels = async () => {
    modelsLoading.value = true
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.MODELS, { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '获取模型列表失败')
      models.value = Array.isArray(result?.data) ? result.data : []
    } catch (error) {
      showError('获取模型列表失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      modelsLoading.value = false
    }
  }

  const saveModel = async (model: Partial<AdminModel>, isEdit: boolean, modelId?: string) => {
    try {
      const endpoint = isEdit ? API_ENDPOINTS.ADMIN.MODEL(modelId!) : API_ENDPOINTS.ADMIN.MODELS
      const method = isEdit ? 'PUT' : 'POST'
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(model)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '保存模型失败')
      showSuccess(isEdit ? '模型更新成功' : '模型创建成功')
      await fetchModels()
      return true
    } catch (error) {
      showError('保存失败', error instanceof Error ? error.message : '请稍后重试')
      return false
    }
  }

  const deleteModel = async (modelId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.MODEL(modelId), {
        method: 'DELETE',
        credentials: 'include'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '删除模型失败')
      showSuccess('模型删除成功')
      await fetchModels()
      return true
    } catch (error) {
      showError('删除失败', error instanceof Error ? error.message : '请稍后重试')
      return false
    }
  }

  const toggleModelEnabled = async (model: AdminModel, enabled: boolean) => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.MODEL(model.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          id: model.id,
          name: model.name,
          model_id: model.model_id,
          base_url: model.base_url,
          api_key_id: model.api_key_id || null,
          temperature: model.temperature,
          capabilities: model.capabilities,
          priority: model.priority,
          enabled
        })
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '更新启用状态失败')
      // Update local state
      const index = models.value.findIndex(m => m.id === model.id)
      if (index !== -1) {
        models.value[index] = { ...models.value[index], enabled }
      }
      return true
    } catch (error) {
      showError('状态更新失败', error instanceof Error ? error.message : '请稍后重试')
      return false
    }
  }

  // API Keys
  const fetchApiKeys = async () => {
    apiKeysLoading.value = true
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.API_KEYS, { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '获取 API Key 列表失败')
      apiKeys.value = Array.isArray(result?.data) ? result.data : []
    } catch (error) {
      showError('获取 API Key 失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      apiKeysLoading.value = false
    }
  }

  const saveApiKey = async (key: { id?: string; name: string; api_key?: string }, isEdit: boolean, keyId?: string) => {
    try {
      const endpoint = isEdit ? API_ENDPOINTS.ADMIN.API_KEY(keyId!) : API_ENDPOINTS.ADMIN.API_KEYS
      const method = isEdit ? 'PUT' : 'POST'
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(key)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '保存 API Key 失败')
      showSuccess(isEdit ? 'API Key 更新成功' : 'API Key 创建成功')
      await fetchApiKeys()
      return true
    } catch (error) {
      showError('保存失败', error instanceof Error ? error.message : '请稍后重试')
      return false
    }
  }

  const deleteApiKey = async (keyId: string) => {
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.API_KEY(keyId), {
        method: 'DELETE',
        credentials: 'include'
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '删除 API Key 失败')
      showSuccess('API Key 删除成功')
      await fetchApiKeys()
      return true
    } catch (error) {
      showError('删除失败', error instanceof Error ? error.message : '请稍后重试')
      return false
    }
  }

  // Stats
  const fetchStats = async () => {
    statsLoading.value = true
    try {
      const response = await fetch(API_ENDPOINTS.ADMIN.STATS, { credentials: 'include' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || result.message || '获取统计失败')
      if (result?.success) {
        stats.value = result.data
      } else {
        stats.value = result
      }
    } catch (error) {
      showError('获取统计失败', error instanceof Error ? error.message : '请稍后重试')
    } finally {
      statsLoading.value = false
    }
  }

  // Fetch all admin data
  const fetchAllData = async () => {
    await Promise.all([
      fetchUsers(),
      fetchModels(),
      fetchApiKeys(),
      fetchStats()
    ])
  }

  return {
    // State
    users,
    models,
    apiKeys,
    stats,
    usersLoading,
    modelsLoading,
    apiKeysLoading,
    statsLoading,
    toasts,
    // Computed
    sortedModels,
    sortedApiKeys,
    // Actions
    fetchUsers,
    deleteUser,
    updateUserRole,
    updateUserStatus,
    updateUserModels,
    fetchModels,
    saveModel,
    deleteModel,
    toggleModelEnabled,
    fetchApiKeys,
    saveApiKey,
    deleteApiKey,
    fetchStats,
    fetchAllData,
    // Toast
    showToast,
    showError,
    showSuccess
  }
})
