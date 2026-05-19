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
    <div class="absolute inset-0 bg-black/50" @click="modelDialogOpen = false"></div>
    <div class="relative bg-gray-900/90 backdrop-blur-xl border border-white/20 rounded-xl max-w-[640px] w-full mx-4 text-white">
      <div class="p-6 border-b border-white/10">
        <h3 class="text-lg font-semibold">配置模型权限：{{ selectedUser?.username || '-' }}</h3>
      </div>

      <div v-if="modelDialogLoading" class="py-10 flex items-center justify-center">
        <div class="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      </div>

      <div v-else class="p-6 space-y-4">
        <div class="rounded-md border border-white/15 bg-black/20 px-3 py-3 flex items-center justify-between">
          <div>
            <p class="text-sm text-white">允许访问所有模型</p>
            <p class="text-xs text-white/60 mt-1">关闭后仅允许访问下方勾选模型。</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="accessAllModels"
              class="sr-only peer"
            />
            <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
          </label>
        </div>

        <div v-if="!accessAllModels" class="rounded-md border border-white/15 bg-black/20 p-3 max-h-72 overflow-y-auto space-y-2">
          <p v-if="availableModels.length === 0" class="text-xs text-white/60">当前没有可分配模型。</p>
          <label
            v-for="model in availableModels"
            :key="model.id"
            class="flex items-start gap-3 py-1 cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="allowedModelIds.includes(model.id)"
              @change="toggleAllowedModel(model.id, ($event.target as HTMLInputElement).checked)"
              class="mt-1 w-4 h-4 rounded border-white/30 bg-black/20 text-blue-500 focus:ring-blue-500/30"
            />
            <span class="text-sm text-white">
              {{ model.name }}
              <span class="ml-2 text-xs text-white/60">{{ model.model_id }}</span>
            </span>
          </label>
        </div>
      </div>

      <div class="p-6 border-t border-white/10 flex justify-end gap-3">
        <button
          @click="modelDialogOpen = false"
          :disabled="modelDialogSaving"
          class="px-4 py-2 rounded-lg border border-white/30 bg-black/20 text-white hover:bg-white/10 disabled:opacity-50"
        >
          取消
        </button>
        <button
          @click="saveModelAccess"
          :disabled="modelDialogSaving || modelDialogLoading"
          class="px-4 py-2 rounded-lg bg-white/20 border border-white/20 text-white hover:bg-white/30 disabled:opacity-50 flex items-center gap-2"
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
