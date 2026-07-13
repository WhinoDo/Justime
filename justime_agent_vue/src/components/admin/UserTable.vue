<script setup lang="ts">
import { computed } from 'vue'
import type { User } from '@/types/admin'
import {
  Search,
  Trash2,
  Shield,
  ShieldCheck,
  User as UserIcon,
  Ban,
  CheckCircle2
} from 'lucide-vue-next'

interface Props {
  users: User[]
  loading: boolean
  currentUserId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  delete: [userId: string]
  updateRole: [userId: string, role: 'admin' | 'user']
  updateStatus: [userId: string, status: 'active' | 'banned']
  configureModels: [user: User]
}>()

const searchTerm = defineModel<string>('searchTerm', { default: '' })

const filteredUsers = computed(() => {
  const term = searchTerm.value.toLowerCase()
  return props.users.filter(user =>
    user.username.toLowerCase().includes(term) ||
    user.email.toLowerCase().includes(term)
  )
})

const formatDate = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString()
}

const roleIcon = (role: string) => role === 'admin' ? Shield : UserIcon
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h2 class="text-2xl font-bold tracking-tight text-gray-900">用户管理</h2>
        <p class="text-gray-500">查看并管理系统中的所有注册用户</p>
      </div>
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="搜索用户..."
          class="pl-9 w-full sm:w-[300px] bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-md px-3 py-2"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>

    <!-- Table -->
    <div v-else class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden w-full">
      <table class="w-full">
        <thead class="bg-gray-50">
          <tr class="border-b border-gray-200">
            <th class="text-left p-4 text-gray-600 font-medium text-sm">用户</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">角色</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">状态</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">模型权限</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">注册时间</th>
            <th class="text-left p-4 text-gray-600 font-medium text-sm">最后登录</th>
            <th class="text-right p-4 text-gray-600 font-medium text-sm">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredUsers.length === 0" class="border-b border-gray-200">
            <td colspan="7" class="p-8 text-center text-gray-400 text-sm">
              没有找到匹配的用户
            </td>
          </tr>
          <tr
            v-for="user in filteredUsers"
            :key="user.id"
            class="border-b border-gray-100 hover:bg-purple-50/50"
          >
            <td class="p-4">
              <div class="flex flex-col">
                <span class="font-medium text-gray-900">{{ user.username }}</span>
                <span class="text-xs text-gray-500">{{ user.email }}</span>
              </div>
            </td>
            <td class="p-4">
              <div class="flex items-center gap-1">
                <component
                  :is="roleIcon(user.role)"
                  :class="['w-3 h-3', user.role === 'admin' ? 'text-purple-500' : 'text-gray-400']"
                />
                <span :class="['text-sm', user.role === 'admin' ? 'text-purple-600 font-medium' : 'text-gray-600']">
                  {{ user.role === 'admin' ? '管理员' : '普通用户' }}
                </span>
              </div>
            </td>
            <td class="p-4">
              <span
                :class="[
                  'px-2 py-1 rounded-full text-xs font-medium',
                  user.status === 'active'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                ]"
              >
                {{ user.status === 'active' ? '活跃' : '封禁' }}
              </span>
            </td>
            <td class="p-4">
              <span
                v-if="user.access_all_models"
                class="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
              >
                全部模型
              </span>
              <span
                v-else
                class="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
              >
                已限制（{{ user.allowed_model_ids?.length || 0 }}）
              </span>
            </td>
            <td class="p-4 text-gray-500 text-sm">
              {{ formatDate(user.created_at) }}
            </td>
            <td class="p-4 text-gray-500 text-sm">
              {{ formatDate(user.last_login) }}
            </td>
            <td class="p-4 text-right">
              <div class="relative inline-block text-left">
                <div class="flex items-center justify-end gap-2">
                  <button
                    @click="emit('configureModels', user)"
                    class="p-1.5 rounded hover:bg-purple-50 text-gray-500 hover:text-purple-600"
                    title="配置模型权限"
                  >
                    <ShieldCheck class="w-4 h-4" />
                  </button>
                  <button
                    @click="emit('updateRole', user.id, user.role === 'admin' ? 'user' : 'admin')"
                    :disabled="currentUserId === user.id"
                    class="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    :title="user.role === 'admin' ? '降级为普通用户' : '提升为管理员'"
                  >
                    <component :is="user.role === 'admin' ? UserIcon : Shield" class="w-4 h-4" />
                  </button>
                  <button
                    @click="emit('updateStatus', user.id, user.status === 'active' ? 'banned' : 'active')"
                    :disabled="currentUserId === user.id"
                    class="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    :title="user.status === 'active' ? '封禁账户' : '启用账户'"
                  >
                    <component :is="user.status === 'active' ? Ban : CheckCircle2" class="w-4 h-4" />
                  </button>
                  <button
                    @click="emit('delete', user.id)"
                    :disabled="currentUserId === user.id"
                    class="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-50"
                    title="删除用户"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
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
