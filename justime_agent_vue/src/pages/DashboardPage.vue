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
  <div class="min-h-screen relative overflow-hidden flex flex-col text-white">
    <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
    <div class="relative z-10 p-8">
      <div class="max-w-7xl mx-auto">
        <h1 class="text-3xl font-bold mb-4">仪表盘</h1>
        <p class="text-white/70 mb-8">欢迎回来，{{ authStore.user?.displayName || authStore.user?.username }}！</p>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
            <h3 class="text-lg font-semibold mb-2">对话</h3>
            <p class="text-white/60 text-sm">开始新的 AI 对话</p>
            <button
              @click="goToChat"
              class="mt-4 px-4 py-2 rounded-lg bg-white/20 border border-white/20 text-white hover:bg-white/30 text-sm"
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
