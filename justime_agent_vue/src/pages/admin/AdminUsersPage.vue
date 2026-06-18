<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import UserTable from '@/components/admin/UserTable.vue'
import type { User, AdminModel } from '@/types/admin'

const adminStore = useAdminStore()
const authStore = useAuthStore()

const searchTerm = ref('')
const modelDialogOpen = ref(false)
const modelDialogLoading = ref(false)
const modelDialogSaving = ref(false)
const selectedUser = ref<User | null>(null)
const accessAllModels = ref(true)
const allowedModelIds = ref<string[]>([])
const availableModels = ref<AdminModel[]>([])

onMounted(() => {
  adminStore.fetchUsers()
})

const handleDeleteUser = async (userId: string) => {
  if (!confirm('确定要删除该用户吗？此操作无法撤销。')) return
  await adminStore.deleteUser(userId)
}

const handleUpdateRole = async (userId: string, role: 'admin' | 'user') => {
  await adminStore.updateUserRole(userId, role)
}

const handleUpdateStatus = async (userId: string, status: 'active' | 'banned') => {
  await adminStore.updateUserStatus(userId, status)
}

const openModelAccessDialog = async (user: User) => {
  selectedUser.value = user
  accessAllModels.value = Boolean(user.access_all_models)
  allowedModelIds.value = Array.isArray(user.allowed_model_ids) ? [...user.allowed_model_ids] : []
  modelDialogLoading.value = true
  modelDialogOpen.value = true

  try {
    await adminStore.fetchModels()
    availableModels.value = adminStore.models.filter(m => m.enabled !== false)
  } catch (error) {
    adminStore.showError('加载模型列表失败', error instanceof Error ? error.message : '请稍后重试')
  } finally {
    modelDialogLoading.value = false
  }
}

const toggleAllowedModel = (modelId: string, checked: boolean) => {
  if (checked) {
    if (!allowedModelIds.value.includes(modelId)) {
      allowedModelIds.value.push(modelId)
    }
  } else {
    allowedModelIds.value = allowedModelIds.value.filter(id => id !== modelId)
  }
}

const saveModelAccess = async () => {
  if (!selectedUser.value) return
  if (!accessAllModels.value && allowedModelIds.value.length === 0) {
    adminStore.showError('请选择至少一个模型', '关闭"允许访问所有模型"后，必须至少勾选一个模型。')
    return
  }

  modelDialogSaving.value = true
  try {
    const success = await adminStore.updateUserModels(
      selectedUser.value.id,
      accessAllModels.value,
      allowedModelIds.value
    )
    if (success) {
      modelDialogOpen.value = false
    }
  } finally {
    modelDialogSaving.value = false
  }
}
</script>

<template>
  <UserTable
    v-model:search-term="searchTerm"
    :users="adminStore.users"
    :loading="adminStore.usersLoading"
    :current-user-id="authStore.user?.id"
    @delete="handleDeleteUser"
    @update-role="handleUpdateRole"
    @update-status="handleUpdateStatus"
    @configure-models="openModelAccessDialog"
  />

  <!-- Model Access Dialog -->
  <div
    v-if="modelDialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div class="absolute inset-0 bg-black/30" @click="modelDialogOpen = false"></div>
    <div class="relative bg-white border border-gray-200 shadow-xl rounded-xl max-w-[640px] w-full mx-4">
      <div class="p-6 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">配置模型权限：{{ selectedUser?.username || '-' }}</h3>
      </div>

      <div v-if="modelDialogLoading" class="py-10 flex items-center justify-center">
        <div class="w-6 h-6 border-2 border-purple-300 border-t-purple-600 rounded-full animate-spin"></div>
      </div>

      <div v-else class="p-6 space-y-4">
        <div class="rounded-md border border-gray-200 bg-gray-50 px-3 py-3 flex items-center justify-between">
          <div>
            <p class="text-sm text-gray-900">允许访问所有模型</p>
            <p class="text-xs text-gray-500 mt-1">关闭后仅允许访问下方勾选模型。</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="accessAllModels"
              class="sr-only peer"
            />
            <div class="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
          </label>
        </div>

        <div v-if="!accessAllModels" class="rounded-md border border-gray-200 bg-gray-50 p-3 max-h-72 overflow-y-auto space-y-2">
          <p v-if="availableModels.length === 0" class="text-xs text-gray-500">当前没有可分配模型。</p>
          <label
            v-for="model in availableModels"
            :key="model.id"
            class="flex items-start gap-3 py-1 cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="allowedModelIds.includes(model.id)"
              @change="toggleAllowedModel(model.id, ($event.target as HTMLInputElement).checked)"
              class="mt-1 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span class="text-sm text-gray-900">
              {{ model.name }}
              <span class="ml-2 text-xs text-gray-500">{{ model.model_id }}</span>
            </span>
          </label>
        </div>
      </div>

      <div class="p-6 border-t border-gray-200 flex justify-end gap-3">
        <button
          @click="modelDialogOpen = false"
          :disabled="modelDialogSaving"
          class="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          取消
        </button>
        <button
          @click="saveModelAccess"
          :disabled="modelDialogSaving || modelDialogLoading"
          class="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          <div v-if="modelDialogSaving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          保存权限
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
