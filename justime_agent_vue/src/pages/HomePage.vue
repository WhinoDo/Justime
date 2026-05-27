<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const goToDashboard = () => {
  router.push('/dashboard')
}

const goToAdmin = () => {
  router.push('/admin')
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden flex flex-col items-center justify-center text-white">
    <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
    <div class="relative z-10 text-center space-y-6">
      <h1 class="text-4xl font-bold">聚时 Agent</h1>
      <p class="text-white/70">Vue 3 版本</p>
      <div class="flex gap-4 justify-center">
        <button
          v-if="authStore.isAuthenticated"
          @click="goToDashboard"
          class="px-6 py-3 rounded-lg bg-white/20 border border-white/20 text-white hover:bg-white/30 transition-colors"
        >
          进入仪表盘
        </button>
        <button
          v-if="authStore.isAdmin"
          @click="goToAdmin"
          class="px-6 py-3 rounded-lg bg-white/20 border border-white/20 text-white hover:bg-white/30 transition-colors"
        >
          管理后台
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
