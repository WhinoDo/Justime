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

defineProps<Props>()

const emit = defineEmits<{
  create: []
  edit: [key: AdminApiKey]
  delete: [key: AdminApiKey]
}>()

const sortedKeys = computed(() => {
  return [...props.apiKeys].sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
})

const props = defineProps<Props>()
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-white">API Key 管理</h2>
        <p class="text-white/70">管理可复用的系统 API Key，供模型配置统一引用。</p>
      </div>
      <button
        @click="emit('create')"
        class="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/20 border border-white/20 text-white hover:bg-white/30 transition-colors"
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
    <div v-else-if="sortedKeys.length === 0" class="rounded-2xl border border-dashed border-white/25 bg-white/10 backdrop-blur-xl p-10 text-center">
      <p class="text-white/80 text-sm">当前还没有通用 API Key</p>
      <p class="text-white/60 text-xs mt-2">添加后可在模型管理中直接引用，避免重复填写。</p>
      <button
        @click="emit('create')"
        class="flex items-center gap-2 mt-5 mx-auto px-4 py-2 rounded-lg bg-white/20 border border-white/20 text-white hover:bg-white/30 transition-colors"
      >
        <Plus class="w-4 h-4" />
        添加首个 API Key
      </button>
    </div>

    <!-- Table -->
    <div v-else class="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden text-white w-full">
      <table class="w-full text-white">
        <thead class="bg-white/5">
          <tr class="border-b border-white/10">
            <th class="text-left p-4 text-white/80 font-medium">名称</th>
            <th class="text-left p-4 text-white/80 font-medium">状态</th>
            <th class="text-left p-4 text-white/80 font-medium">更新时间</th>
            <th class="text-right p-4 text-white/80 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="key in sortedKeys"
            :key="key.id"
            class="border-b border-white/10 hover:bg-white/5"
          >
            <td class="p-4">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-white/10 border border-white/15 flex items-center justify-center">
                  <KeyRound class="w-4 h-4 text-white/70" />
                </div>
                <div class="flex flex-col">
                  <span class="font-medium text-white">{{ key.name }}</span>
                  <span class="text-xs text-white/50">{{ key.id }}</span>
                </div>
              </div>
            </td>
            <td class="p-4">
              <span
                :class="[
                  'px-2 py-1 rounded-full text-xs',
                  key.has_api_key
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-gray-500/20 text-gray-200'
                ]"
              >
                {{ key.has_api_key ? '已配置' : '未配置' }}
              </span>
            </td>
            <td class="p-4 text-white/70 text-sm">
              {{ key.updated_at || '-' }}
            </td>
            <td class="p-4 text-right">
              <div class="flex items-center justify-end gap-2">
                <button
                  @click="emit('edit', key)"
                  class="p-1.5 rounded border border-white/30 bg-black/20 text-white hover:bg-white/10"
                >
                  <Edit2 class="w-4 h-4" />
                </button>
                <button
                  @click="emit('delete', key)"
                  class="p-1.5 rounded border border-red-300/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
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
