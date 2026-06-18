<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  LayoutDashboard,
  Users,
  ServerCog,
  KeyRound,
  Settings,
  LogOut,
  X,
  ArrowLeft
} from 'lucide-vue-next'

interface Props {
  isOpen: boolean
}

defineProps<Props>()
const emit = defineEmits<{
  toggle: []
}>()

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const menuItems = [
  {
    title: '概览仪表盘',
    icon: LayoutDashboard,
    href: '/admin'
  },
  {
    title: '用户管理',
    icon: Users,
    href: '/admin/users'
  },
  {
    title: '模型管理',
    icon: ServerCog,
    href: '/admin/models'
  },
  {
    title: 'API Key 管理',
    icon: KeyRound,
    href: '/admin/apikeys'
  },
  {
    title: '系统设置',
    icon: Settings,
    href: '/admin/settings'
  }
]

const isActive = (href: string) => {
  if (href === '/admin') {
    return route.path === '/admin'
  }
  return route.path.startsWith(href)
}

const handleLogout = async () => {
  await authStore.logout()
  router.push('/auth/login')
}

const goToDashboard = () => {
  router.push('/dashboard')
}

const userInitial = computed(() => {
  return authStore.user?.displayName?.[0]?.toUpperCase() || 'A'
})
</script>

<template>
  <aside
    :class="[
      'fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    ]"
  >
    <div class="h-full flex flex-col">
      <!-- Logo -->
      <div class="h-16 flex items-center px-6 border-b border-gray-200">
        <span class="text-xl font-bold text-purple-700">
          矩时管理后台
        </span>
        <button
          class="ml-auto lg:hidden text-gray-400 hover:text-gray-600 transition-colors"
          @click="emit('toggle')"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 p-4 space-y-1 overflow-y-auto">
        <RouterLink
          v-for="item in menuItems"
          :key="item.href"
          :to="item.href"
          :class="[
            'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
            isActive(item.href)
              ? 'bg-purple-50 text-purple-700 shadow-sm'
              : 'text-gray-600 hover:bg-gray-50 hover:text-purple-600'
          ]"
        >
          <component
            :is="item.icon"
            :class="['w-5 h-5', isActive(item.href) ? 'text-purple-600' : 'text-gray-400']"
          />
          <span class="font-medium">{{ item.title }}</span>
        </RouterLink>
      </nav>

      <!-- 返回控制台 -->
      <div class="px-4 py-2 border-t border-gray-200">
        <div
          class="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-gray-600 hover:bg-gray-50 hover:text-purple-600 cursor-pointer"
          @click="goToDashboard"
        >
          <ArrowLeft class="w-5 h-5 text-gray-400" />
          <span class="font-medium text-sm">返回普通控制台</span>
        </div>
      </div>

      <!-- User Profile -->
      <div class="p-4 border-t border-gray-200">
        <div class="flex items-center gap-3 px-4 py-3">
          <div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold">
            {{ userInitial }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-900 truncate">
              {{ authStore.user?.displayName }}
            </p>
            <p class="text-xs text-gray-500 truncate">
              {{ authStore.user?.email }}
            </p>
          </div>
          <button
            @click="handleLogout"
            class="p-2 text-gray-400 hover:text-red-500 transition-colors"
            title="退出登录"
          >
            <LogOut class="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
</style>
