<script setup lang="ts">
import { computed } from 'vue'
import type { AdminModel, AdminApiKey } from '@/types/admin'
import {
  Plus,
  Trash2,
  Edit2
} from 'lucide-vue-next'

interface Props {
  models: AdminModel[]
  apiKeys: AdminApiKey[]
  loading: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  create: []
  edit: [model: AdminModel]
  delete: [model: AdminModel]
  toggleEnabled: [model: AdminModel, enabled: boolean]
}>()

const sortedModels = computed(() => {
  return [...props.models].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-gray-900">系统模型管理</h2>
        <p class="text-gray-500">管理平台全局 LLM 模型配置（新增、编辑、启用、删除）</p>
      </div>
      <button
        @click="emit('create')"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
      >
        <Plus class="w-4 h-4" />
        新增模型
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="sortedModels.length === 0" class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p class="text-gray-700 text-sm">当前还没有系统模型配置</p>
      <p class="text-gray-400 text-xs mt-2">点击下方按钮添加首个模型后，普通用户即可在模型配置页看到它。</p>
      <button
        @click="emit('create')"
        class="flex items-center gap-2 mt-5 mx-auto px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
      >
        <Plus class="w-4 h-4" />
        添加首个模型
      </button>
    </div>

    <!-- Table -->
    <div v-else class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden w-full">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr class="border-b border-gray-200">
            <th class="text-left p-4 text-gray-600 font-medium text-sm">名称</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">模型ID</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">优先级</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">能力标签</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">启用</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">API Key</th>
            <th class="text-right p-4 text-gray-600 font-medium text-sm">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="model in sortedModels"
            :key="model.id"
            class="border-b border-gray-100 hover:bg-purple-50/50"
          >
            <td class="p-4">
              <div class="flex flex-col">
                <span class="font-medium text-gray-900">{{ model.name }}</span>
                <span class="text-xs text-gray-500">{{ model.base_url }}</span>
              </div>
            </td>
            <td class="p-4 font-mono text-xs text-gray-700">
              {{ model.model_id }}
            </td>
            <td class="p-4 text-gray-700">
              {{ model.priority }}
            </td>
            <td class="p-4">
              <div class="flex flex-wrap gap-1">
                <span v-if="model.capabilities.length === 0" class="text-gray-400 text-xs">-</span>
                <span
                  v-for="cap in model.capabilities"
                  :key="`${model.id}-${cap}`"
                  class="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700"
                >
                  {{ cap }}
                </span>
              </div>
            </td>
            <td class="p-4">
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  :checked="model.enabled"
                  @change="emit('toggleEnabled', model, ($event.target as HTMLInputElement).checked)"
                  class="sr-only peer"
                />
                <div class="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </td>
            <td class="p-4">
              <div class="flex flex-col gap-1">
                <span
                  :class="[
                    'px-2 py-0.5 rounded text-xs font-medium',
                    model.has_api_key
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  ]"
                >
                  {{ model.has_api_key ? '已配置' : '未配置' }}
                </span>
                <span v-if="model.api_key_id" class="text-xs text-gray-500">
                  引用: {{ model.api_key_name || model.api_key_id }}
                </span>
              </div>
            </td>
            <td class="p-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button
                  @click="emit('edit', model)"
                  class="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600"
                >
                  <Edit2 class="w-4 h-4" />
                </button>
                <button
                  @click="emit('delete', model)"
                  class="p-1.5 rounded border border-red-200 bg-red-50 text-red-500 hover:bg-red-100"
                >
                  <Trash2 class="w-4 h-4" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
</style>
