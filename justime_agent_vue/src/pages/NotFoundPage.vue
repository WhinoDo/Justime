<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden flex items-center justify-center text-foreground">
    <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-[hsl(260_25%_6%)] dark:via-[hsl(260_20%_10%)] dark:to-[hsl(260_25%_8%)]"></div>
    <div class="relative z-10 text-center space-y-4">
      <h1 class="text-6xl font-bold text-foreground">404</h1>
      <p class="text-muted-foreground">页面未找到</p>
      <button
        @click="goHome"
        class="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        返回首页
      </button>
    </div>
  </div>
</template>

<style scoped>
</style>
