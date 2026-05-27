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
    color: 'text-indigo-300',
    bg: 'bg-indigo-500/20',
    ring: 'ring-indigo-500/30',
  },
  {
    title: 'API Key 管理',
    description: '管理可复用的系统 API Key，供模型配置统一引用。',
    icon: KeyRound,
    href: '/admin/apikeys',
    color: 'text-amber-300',
    bg: 'bg-amber-500/20',
    ring: 'ring-amber-500/30',
  },
  {
    title: '用户管理',
    description: '管理用户账户、角色、状态和模型访问权限。',
    icon: Shield,
    href: '/admin/users',
    color: 'text-emerald-300',
    bg: 'bg-emerald-500/20',
    ring: 'ring-emerald-500/30',
  },
]

const navigateTo = (href: string) => {
  router.push(href)
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h2 class="text-3xl font-bold tracking-tight text-white">系统设置</h2>
      <p class="text-white/70 mt-2">管理平台的全局配置项。</p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="group in settingsGroups"
        :key="group.href"
        @click="navigateTo(group.href)"
        class="group p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/15 shadow-xl transition-all hover:bg-white/10 hover:border-white/25 cursor-pointer"
      >
        <div :class="['h-12 w-12 rounded-xl flex items-center justify-center mb-4', group.bg, group.ring, group.color]">
          <component :is="group.icon" class="h-6 w-6" />
        </div>
        <h3 class="text-lg font-semibold text-white mb-2">{{ group.title }}</h3>
        <p class="text-sm text-white/60">{{ group.description }}</p>
        <div class="mt-4">
          <span class="text-xs text-white/40 group-hover:text-white/70 transition-colors">
            前往配置 →
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
