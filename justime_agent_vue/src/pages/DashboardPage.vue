<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const goToChat = () => {
  router.push('/chat')
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden flex flex-col">
    <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-purple-100"></div>
    <div class="relative z-10 p-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold mb-4 text-gray-900">仪表盘</h1>
        <p class="text-gray-500 mb-8">欢迎回来，{{ authStore.user?.displayName || authStore.user?.username }}！</p>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-6 rounded-2xl bg-white border border-purple-100 shadow-sm">
            <h3 class="text-lg font-semibold mb-2 text-gray-900">对话</h3>
            <p class="text-gray-500 text-sm">开始新的 AI 对话</p>
            <button
              @click="goToChat"
              class="mt-4 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 text-sm shadow-sm"
            >
              开始对话
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
