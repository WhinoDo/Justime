<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden flex items-center justify-center text-white">
    <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
    <div class="relative z-10 text-center space-y-4">
      <h1 class="text-6xl font-bold">404</h1>
      <p class="text-white/70">页面未找到</p>
      <button
        @click="goHome"
        class="px-4 py-2 rounded-lg border border-white/30 bg-black/20 text-white hover:bg-white/10 hover:text-white transition-colors"
      >
        返回首页
      </button>
    </div>
  </div>
</template>

<style scoped>
</style>
