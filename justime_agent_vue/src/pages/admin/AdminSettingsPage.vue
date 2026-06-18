<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  ServerCog,
  KeyRound,
  Shield
} from 'lucide-vue-next'

const router = useRouter()

const settingsGroups = [
  {
    title: '模型配置',
    description: '管理系统全局 LLM 模型，配置服务地址、API Key 和能力标签。',
    icon: ServerCog,
    href: '/admin/models',
    color: 'text-purple-600',
    bg: 'bg-purple-100',
    ring: 'ring-purple-200',
  },
  {
    title: 'API Key 管理',
    description: '管理可复用的系统 API Key，供模型配置统一引用。',
    icon: KeyRound,
    href: '/admin/apikeys',
    color: 'text-violet-600',
    bg: 'bg-violet-100',
    ring: 'ring-violet-200',
  },
  {
    title: '用户管理',
    description: '管理用户账户、角色、状态和模型访问权限。',
    icon: Shield,
    href: '/admin/users',
    color: 'text-fuchsia-600',
    bg: 'bg-fuchsia-100',
    ring: 'ring-fuchsia-200',
  },
]

const navigateTo = (href: string) => {
  router.push(href)
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h2 class="text-3xl font-bold tracking-tight text-gray-900">系统设置</h2>
      <p class="text-gray-500 mt-2">管理平台的全局配置项。</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="group in settingsGroups"
        :key="group.href"
        @click="navigateTo(group.href)"
        class="group p-6 rounded-2xl bg-white border border-gray-200 shadow-sm transition-all hover:shadow-md hover:border-purple-200 cursor-pointer"
      >
        <div :class="['h-12 w-12 rounded-xl flex items-center justify-center mb-4', group.bg, group.ring, group.color]">
          <component :is="group.icon" class="h-6 w-6" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 mb-2">{{ group.title }}</h3>
        <p class="text-sm text-gray-500">{{ group.description }}</p>
        <div class="mt-4">
          <span class="text-xs text-gray-400 group-hover:text-purple-600 transition-colors">
            前往配置 →
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
