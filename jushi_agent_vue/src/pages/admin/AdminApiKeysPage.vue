<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import ApiKeyManager from '@/components/admin/ApiKeyManager.vue'
import type { AdminApiKey, ApiKeyFormData } from '@/types/admin'

const adminStore = useAdminStore()

const dialogOpen = ref(false)
const editingKey = ref<AdminApiKey | null>(null)
const saving = ref(false)

const form = ref<ApiKeyFormData>({
  id: '',
  name: '',
  api_key: ''
})

onMounted(() => {
  adminStore.fetchApiKeys()
})

const resetForm = () => {
  form.value = {
    id: '',
    name: '',
    api_key: ''
  }
}

const openCreateDialog = () => {
  editingKey.value = null
  resetForm()
  dialogOpen.value = true
}

const openEditDialog = (key: AdminApiKey) => {
  editingKey.value = key
  form.value = {
    id: key.id,
    name: key.name,
    api_key: ''
  }
  dialogOpen.value = true
}

const handleSubmit = async () => {
  if (!form.value.name.trim()) {
    adminStore.showError('表单不完整', '请填写 API Key 名称')
    return
  }

  if (!editingKey.value && !form.value.api_key.trim()) {
    adminStore.showError('表单不完整', '新增 API Key 时必须输入密钥')
    return
  }

  saving.value = true
  try {
    const isEdit = !!editingKey.value
    const payload: { id?: string; name: string; api_key?: string } = {
      id: form.value.id.trim() || undefined,
      name: form.value.name.trim()
    }
    if (!isEdit || form.value.api_key.trim()) {
      payload.api_key = form.value.api_key.trim()
    }

    const success = await adminStore.saveApiKey(payload, isEdit, editingKey.value?.id)
    if (success) {
      dialogOpen.value = false
    }
  } finally {
    saving.value = false
  }
}

const handleDelete = async (key: AdminApiKey) => {
  if (!confirm(`确定要删除 API Key "${key.name}" 吗？`)) return
  await adminStore.deleteApiKey(key.id)
}
</script>

<template>
  <ApiKeyManager
    :api-keys="adminStore.apiKeys"
    :loading="adminStore.apiKeysLoading"
    @create="openCreateDialog"
    @edit="openEditDialog"
    @delete="handleDelete"
  />

  <!-- API Key Dialog -->
  <div
    v-if="dialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div class="absolute inset-0 bg-black/50" @click="dialogOpen = false"></div>
    <div class="relative bg-gray-900/90 backdrop-blur-xl border border-white/20 rounded-xl max-w-[560px] w-full mx-4 text-white">
      <div class="p-6 border-b border-white/10">
        <h3 class="text-lg font-semibold">{{ editingKey ? '编辑 API Key' : '新增 API Key' }}</h3>
      </div>

      <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="space-y-1">
          <p class="text-sm text-white/70">配置ID（可选）</p>
          <input
            v-model="form.id"
            type="text"
            class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
            autocomplete="off"
          />
        </div>
        <div class="space-y-1">
          <p class="text-sm text-white/70">显示名称</p>
          <input
            v-model="form.name"
            type="text"
            class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
            autocomplete="off"
          />
        </div>
        <div class="sm:col-span-2 space-y-1">
          <p class="text-sm text-white/70">API Key {{ editingKey ? '(留空表示不修改)' : '' }}</p>
          <input
            v-model="form.api_key"
            type="password"
            class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
            autocomplete="new-password"
          />
        </div>
      </div>

      <div class="p-6 border-t border-white/10 flex justify-end gap-3">
        <button
          @click="dialogOpen = false"
          :disabled="saving"
          class="px-4 py-2 rounded-lg border border-white/30 bg-black/20 text-white hover:bg-white/10 disabled:opacity-50"
        >
          取消
        </button>
        <button
          @click="handleSubmit"
          :disabled="saving"
          class="px-4 py-2 rounded-lg bg-white/20 border border-white/20 text-white hover:bg-white/30 disabled:opacity-50 flex items-center gap-2"
        >
          <div v-if="saving" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          {{ editingKey ? '保存修改' : '创建 API Key' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
