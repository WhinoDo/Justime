<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import ModelConfigTable from '@/components/admin/ModelConfigTable.vue'
import type { AdminModel, ModelFormData, AdminApiKey } from '@/types/admin'

const adminStore = useAdminStore()

const dialogOpen = ref(false)
const editingModel = ref<AdminModel | null>(null)
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ success: boolean; message: string; latencyMs?: number } | null>(null)

const form = ref<ModelFormData>({
  id: '',
  name: '',
  model_id: '',
  base_url: '',
  api_key: '',
  api_key_id: '',
  api_key_mode: 'manual',
  temperature: '0.7',
  capabilities: [],
  priority: '100',
  enabled: true
})

const capabilityOptions = [
  { value: 'fast', label: 'fast', description: '适合普通问答' },
  { value: 'reasoning', label: 'reasoning', description: '适合深度思考' },
  { value: 'classifier', label: 'classifier', description: '适合路由分发' },
  { value: 'tool_call', label: 'tool_call', description: '支持工具调用' }
]

const availableApiKeys = computed(() => {
  return adminStore.apiKeys.filter(k => k.has_api_key)
})

onMounted(() => {
  adminStore.fetchModels()
  adminStore.fetchApiKeys()
})

const resetForm = () => {
  form.value = {
    id: '',
    name: '',
    model_id: '',
    base_url: '',
    api_key: '',
    api_key_id: availableApiKeys.value.length > 0 ? availableApiKeys.value[0].id : '',
    api_key_mode: availableApiKeys.value.length > 0 ? 'reference' : 'manual',
    temperature: '0.7',
    capabilities: [],
    priority: '100',
    enabled: true
  }
}

const openCreateDialog = () => {
  editingModel.value = null
  resetForm()
  testResult.value = null
  dialogOpen.value = true
}

const openEditDialog = (model: AdminModel) => {
  editingModel.value = model
  form.value = {
    id: model.id,
    name: model.name,
    model_id: model.model_id,
    base_url: model.base_url,
    api_key: '',
    api_key_id: model.api_key_id || '',
    api_key_mode: model.api_key_id ? 'reference' : 'manual',
    temperature: String(model.temperature ?? 0.7),
    capabilities: [...model.capabilities],
    priority: String(model.priority ?? 100),
    enabled: !!model.enabled
  }
  testResult.value = null
  dialogOpen.value = true
}

const toggleCapability = (capability: string, checked: boolean) => {
  if (checked && !form.value.capabilities.includes(capability)) {
    form.value.capabilities.push(capability)
  } else if (!checked && form.value.capabilities.includes(capability)) {
    form.value.capabilities = form.value.capabilities.filter(c => c !== capability)
  }
}

const buildPayload = (forEdit: boolean): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    id: form.value.id.trim() || undefined,
    name: form.value.name.trim(),
    model_id: form.value.model_id.trim(),
    base_url: form.value.base_url.trim(),
    temperature: Number(form.value.temperature || 0.7),
    capabilities: form.value.capabilities,
    priority: Number(form.value.priority || 100),
    enabled: form.value.enabled
  }

  if (form.value.api_key_mode === 'reference') {
    payload.api_key_id = form.value.api_key_id || null
    payload.api_key = ''
  } else {
    payload.api_key_id = null
    if (!forEdit || form.value.api_key.trim()) {
      payload.api_key = form.value.api_key.trim()
    }
  }

  return payload
}

const handleSubmit = async () => {
  if (!form.value.name.trim() || !form.value.model_id.trim() || !form.value.base_url.trim()) {
    adminStore.showError('表单不完整', '请填写名称、模型ID和服务地址')
    return
  }

  if (form.value.api_key_mode === 'reference' && !form.value.api_key_id) {
    adminStore.showError('请选择 API Key', '当前模式为引用系统 API Key，请先选择一个密钥')
    return
  }

  if (!editingModel.value && form.value.api_key_mode === 'manual' && !form.value.api_key.trim()) {
    adminStore.showError('API Key 不能为空', '新增模型且选择手动模式时，必须填写 API Key')
    return
  }

  saving.value = true
  try {
    const isEdit = !!editingModel.value
    const payload = buildPayload(isEdit)
    const success = await adminStore.saveModel(
      payload as Partial<AdminModel>,
      isEdit,
      editingModel.value?.id
    )
    if (success) {
      dialogOpen.value = false
    }
  } finally {
    saving.value = false
  }
}

const handleDelete = async (model: AdminModel) => {
  if (!confirm(`确定要删除模型 "${model.name}" 吗？`)) return
  await adminStore.deleteModel(model.id)
}

const handleToggleEnabled = async (model: AdminModel, enabled: boolean) => {
  await adminStore.toggleModelEnabled(model, enabled)
}

const handleTestConnection = async () => {
  if (!form.value.base_url.trim() || !form.value.model_id.trim()) {
    adminStore.showError('表单不完整', '请填写服务地址和模型ID')
    return
  }

  const hasKey = form.value.api_key_mode === 'reference' ? !!form.value.api_key_id : !!form.value.api_key.trim()
  if (!hasKey) {
    adminStore.showError('API Key 未配置', '请先配置 API Key')
    return
  }

  testing.value = true
  testResult.value = null
  try {
    const payload: Record<string, unknown> = {
      base_url: form.value.base_url.trim(),
      model_id: form.value.model_id.trim()
    }
    if (form.value.api_key_mode === 'reference') {
      payload.api_key_id = form.value.api_key_id
    } else {
      payload.api_key = form.value.api_key.trim()
    }

    const response = await fetch('/api/admin/models/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    })
    const result = await response.json()

    testResult.value = {
      success: result.success,
      message: result.message || (result.success ? '连接成功' : '连接失败'),
      latencyMs: result.latency_ms
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: error instanceof Error ? error.message : '测试请求失败'
    }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <ModelConfigTable
    :models="adminStore.models"
    :api-keys="adminStore.apiKeys"
    :loading="adminStore.modelsLoading"
    @create="openCreateDialog"
    @edit="openEditDialog"
    @delete="handleDelete"
    @toggle-enabled="handleToggleEnabled"
  />

  <!-- Model Dialog -->
  <div
    v-if="dialogOpen"
    class="fixed inset-0 z-50 flex items-center justify-center"
  >
    <div class="absolute inset-0 bg-black/50" @click="dialogOpen = false"></div>
    <div class="relative bg-gray-900/90 backdrop-blur-xl border border-white/20 rounded-xl max-w-[620px] w-full mx-4 max-h-[90vh] overflow-y-auto text-white">
      <div class="p-6 border-b border-white/10">
        <h3 class="text-lg font-semibold">{{ editingModel ? '编辑系统模型' : '新增系统模型' }}</h3>
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
        <div class="space-y-1">
          <p class="text-sm text-white/70">模型ID</p>
          <input
            v-model="form.model_id"
            type="text"
            class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
            autocomplete="off"
          />
        </div>
        <div class="space-y-1">
          <p class="text-sm text-white/70">服务地址</p>
          <input
            v-model="form.base_url"
            type="text"
            class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
            autocomplete="off"
          />
        </div>

        <div class="space-y-1 sm:col-span-2">
          <p class="text-sm text-white/70">API Key 来源</p>
          <select
            v-model="form.api_key_mode"
            class="w-full bg-black/20 border border-white/20 text-white focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
          >
            <option value="reference">引用系统 API Key</option>
            <option value="manual">手动输入独立 API Key</option>
          </select>
        </div>

        <div v-if="form.api_key_mode === 'reference'" class="space-y-1 sm:col-span-2">
          <p class="text-sm text-white/70">选择系统 API Key</p>
          <select
            v-model="form.api_key_id"
            class="w-full bg-black/20 border border-white/20 text-white focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
          >
            <option v-if="availableApiKeys.length === 0" value="">暂无可用 API Key，请先在 API Key 管理中创建</option>
            <option v-for="key in availableApiKeys" :key="key.id" :value="key.id">
              {{ key.name }}
            </option>
          </select>
        </div>

        <div v-else class="space-y-1 sm:col-span-2">
          <p class="text-sm text-white/70">API Key {{ editingModel ? '(留空表示不修改)' : '' }}</p>
          <input
            v-model="form.api_key"
            type="password"
            class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
            autocomplete="new-password"
          />
        </div>

        <div class="sm:col-span-2 space-y-2">
          <button
            type="button"
            @click="handleTestConnection"
            :disabled="testing"
            class="flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-400/40 bg-blue-500/10 text-blue-200 hover:bg-blue-500/20 disabled:opacity-50"
          >
            <div v-if="testing" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span v-else>⚡</span>
            测试连接
          </button>
          <div
            v-if="testResult"
            :class="[
              'p-3 rounded-md text-sm',
              testResult.success
                ? 'bg-green-500/20 border border-green-400/30 text-green-200'
                : 'bg-red-500/20 border border-red-400/30 text-red-200'
            ]"
          >
            <div class="flex items-center gap-2">
              <span>{{ testResult.success ? '✓' : '✗' }}</span>
              <span>{{ testResult.message }}</span>
              <span v-if="testResult.latencyMs !== undefined" class="text-white/60">({{ testResult.latencyMs }}ms)</span>
            </div>
          </div>
        </div>

        <div class="space-y-1">
          <p class="text-sm text-white/70">Temperature</p>
          <input
            v-model="form.temperature"
            type="number"
            min="0"
            max="2"
            step="0.1"
            class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
          />
        </div>
        <div class="space-y-1">
          <p class="text-sm text-white/70">优先级</p>
          <input
            v-model="form.priority"
            type="number"
            min="1"
            max="999"
            class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
          />
        </div>

        <div class="space-y-2 sm:col-span-2">
          <p class="text-sm text-white/70">能力标签</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-md border border-white/15 bg-black/20 p-3">
            <label
              v-for="option in capabilityOptions"
              :key="option.value"
              class="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                :checked="form.capabilities.includes(option.value)"
                @change="toggleCapability(option.value, ($event.target as HTMLInputElement).checked)"
                class="w-4 h-4 rounded border-white/30 bg-black/20 text-blue-500 focus:ring-blue-500/30"
              />
              <span class="text-sm text-white">
                {{ option.label }}
                <span class="ml-2 text-xs text-white/60">{{ option.description }}</span>
              </span>
            </label>
          </div>
        </div>

        <div class="sm:col-span-2 flex items-center gap-3">
          <label class="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              v-model="form.enabled"
              class="sr-only peer"
            />
            <div class="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-500"></div>
          </label>
          <p class="text-sm text-white/70">启用该模型</p>
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
          {{ editingModel ? '保存修改' : '创建模型' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
