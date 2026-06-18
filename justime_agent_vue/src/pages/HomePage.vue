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
  <div class="min-h-screen relative overflow-hidden flex flex-col items-center justify-center">
    <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-purple-100"></div>
    <div class="relative z-10 text-center space-y-6">
      <h1 class="text-4xl font-bold text-gray-900">矩时 Agent</h1>
      <p class="text-gray-500">Vue 3 版本</p>
      <div class="flex gap-4 justify-center">
        <button
          v-if="authStore.isAuthenticated"
          @click="goToDashboard"
          class="px-6 py-3 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-sm"
        >
          进入仪表盘
        </button>
        <button
          v-if="authStore.isAdmin"
          @click="goToAdmin"
          class="px-6 py-3 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
        >
          管理后台
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
