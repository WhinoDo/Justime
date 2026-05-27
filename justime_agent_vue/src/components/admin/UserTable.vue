<script setup lang="ts">
import { computed } from 'vue'
import type { User, AdminModel } from '@/types/admin'
import {
  Search,
  Trash2,
  MoreHorizontal,
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
        <h2 class="text-2xl font-bold tracking-tight text-white">用户管理</h2>
        <p class="text-white/70">查看并管理系统中的所有注册用户</p>
      </div>
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-white/50" />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="搜索用户..."
          class="pl-9 w-full sm:w-[300px] bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center h-96">
      <div class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
    </div>

    <!-- Table -->
    <div v-else class="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl overflow-hidden text-white w-full">
      <table class="w-full text-white">
        <thead class="bg-white/5">
          <tr class="border-b border-white/10">
            <th class="text-left p-4 text-white/80 font-medium">用户</th>
            <th class="text-left p-4 text-white/80 font-medium">角色</th>
            <th class="text-left p-4 text-white/80 font-medium">状态</th>
            <th class="text-left p-4 text-white/80 font-medium">模型权限</th>
            <th class="text-left p-4 text-white/80 font-medium">注册时间</th>
            <th class="text-left p-4 text-white/80 font-medium">最后登录</th>
            <th class="text-right p-4 text-white/80 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="filteredUsers.length === 0" class="border-b border-white/10">
            <td colspan="7" class="p-8 text-center text-white/60">
              没有找到匹配的用户
            </td>
          </tr>
          <tr
            v-for="user in filteredUsers"
            :key="user.id"
            class="border-b border-white/10 hover:bg-white/5"
          >
            <td class="p-4">
              <div class="flex flex-col">
                <span class="font-medium text-white">{{ user.username }}</span>
                <span class="text-xs text-white/60">{{ user.email }}</span>
              </div>
            </td>
            <td class="p-4">
              <div class="flex items-center gap-1">
                <component
                  :is="roleIcon(user.role)"
                  :class="['w-3 h-3', user.role === 'admin' ? 'text-blue-300' : 'text-white/50']"
                />
                <span :class="['text-sm', user.role === 'admin' ? 'text-blue-200 font-medium' : 'text-white/70']">
                  {{ user.role === 'admin' ? '管理员' : '普通用户' }}
                </span>
              </div>
            </td>
            <td class="p-4">
              <span
                :class="[
                  'px-2 py-1 rounded-full text-xs',
                  user.status === 'active'
                    ? 'bg-green-500/20 text-green-200'
                    : 'bg-gray-500/20 text-gray-200'
                ]"
              >
                {{ user.status === 'active' ? '活跃' : '封禁' }}
              </span>
            </td>
            <td class="p-4">
              <span
                v-if="user.access_all_models"
                class="px-2 py-1 rounded-full text-xs bg-blue-500/20 text-blue-200"
              >
                全部模型
              </span>
              <span
                v-else
                class="px-2 py-1 rounded-full text-xs bg-white/10 text-white/80"
              >
                已限制（{{ user.allowed_model_ids?.length || 0 }}）
              </span>
            </td>
            <td class="p-4 text-white/60 text-sm">
              {{ formatDate(user.created_at) }}
            </td>
            <td class="p-4 text-white/60 text-sm">
              {{ formatDate(user.last_login) }}
            </td>
            <td class="p-4 text-right">
              <div class="relative inline-block text-left">
                <div class="flex items-center justify-end gap-2">
                  <button
                    @click="emit('configureModels', user)"
                    class="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white"
                    title="配置模型权限"
                  >
                    <ShieldCheck class="w-4 h-4" />
                  </button>
                  <button
                    @click="emit('updateRole', user.id, user.role === 'admin' ? 'user' : 'admin')"
                    :disabled="currentUserId === user.id"
                    class="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50"
                    :title="user.role === 'admin' ? '降级为普通用户' : '提升为管理员'"
                  >
                    <component :is="user.role === 'admin' ? UserIcon : Shield" class="w-4 h-4" />
                  </button>
                  <button
                    @click="emit('updateStatus', user.id, user.status === 'active' ? 'banned' : 'active')"
                    :disabled="currentUserId === user.id"
                    class="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-50"
                    :title="user.status === 'active' ? '封禁账户' : '启用账户'"
                  >
                    <component :is="user.status === 'active' ? Ban : CheckCircle2" class="w-4 h-4" />
                  </button>
                  <button
                    @click="emit('delete', user.id)"
                    :disabled="currentUserId === user.id"
                    class="p-1.5 rounded hover:bg-red-500/20 text-red-300 disabled:opacity-50"
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
