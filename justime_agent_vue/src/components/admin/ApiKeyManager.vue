<script setup lang="ts">
import { computed } from 'vue'
import type { AdminApiKey } from '@/types/admin'
import {
  Plus,
  Trash2,
  Edit2,
  KeyRound
} from 'lucide-vue-next'

interface Props {
  apiKeys: AdminApiKey[]
  loading: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  create: []
  edit: [key: AdminApiKey]
  delete: [key: AdminApiKey]
}>()

const sortedKeys = computed(() => {
  return [...props.apiKeys].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-gray-900">API Key 管理</h2>
        <p class="text-gray-500">管理可复用的系统 API Key，供模型配置统一引用。</p>
      </div>
      <button
        @click="emit('create')"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
      >
        <Plus class="w-4 h-4" />
        新增 API Key
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="sortedKeys.length === 0" class="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
      <p class="text-gray-700 text-sm">当前还没有通用 API Key</p>
      <p class="text-gray-400 text-xs mt-2">添加后可在模型管理中直接引用，避免重复填写。</p>
      <button
        @click="emit('create')"
        class="flex items-center gap-2 mt-5 mx-auto px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
      >
        <Plus class="w-4 h-4" />
        添加首个 API Key
      </button>
    </div>

    <!-- Table -->
    <div v-else class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden w-full">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr class="border-b border-gray-200">
            <th class="text-left p-4 text-gray-600 font-medium text-sm">名称</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">状态</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">更新时间</th>
            <th class="text-right p-4 text-gray-600 font-medium text-sm">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="key in sortedKeys"
            :key="key.id"
            class="border-b border-gray-100 hover:bg-purple-50/50"
          >
            <td class="p-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center">
                  <KeyRound class="w-4 h-4 text-purple-500" />
                </div>
                <div class="flex flex-col">
                  <span class="font-medium text-gray-900">{{ key.name }}</span>
                  <span class="text-xs text-gray-400">{{ key.id }}</span>
                </div>
              </div>
            </td>
            <td class="p-4">
              <span
                :class="[
                  'px-2 py-1 rounded-full text-xs font-medium',
                  key.has_api_key
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                ]"
              >
                {{ key.has_api_key ? '已配置' : '未配置' }}
              </span>
            </td>
            <td class="p-4 text-gray-600 text-sm">
              {{ key.updated_at || '-' }}
            </td>
            <td class="p-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button
                  @click="emit('edit', key)"
                  class="p-1.5 rounded border border-gray-200 bg-white text-gray-600 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-600"
                >
                  <Edit2 class="w-4 h-4" />
                </button>
                <button
                  @click="emit('delete', key)"
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
