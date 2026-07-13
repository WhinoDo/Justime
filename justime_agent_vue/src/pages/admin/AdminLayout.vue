<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import AdminSidebar from '@/components/admin/AdminSidebar.vue'
import {
  ShieldAlert
} from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const isSidebarOpen = ref(true)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}

// If not admin, show access denied
const isAccessDenied = computed(() => {
  return !authStore.user || authStore.user.role !== 'admin'
})

const goHome = () => {
  router.push('/')
}
</script>

<template>
  <!-- Access Denied View -->
  <div
    v-if="isAccessDenied"
    class="min-h-screen relative overflow-hidden flex items-center justify-center"
  >
    <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-[hsl(260_25%_6%)] dark:via-[hsl(260_20%_10%)] dark:to-[hsl(260_25%_8%)]"></div>
    <div class="relative z-10 text-center space-y-4">
      <ShieldAlert class="w-16 h-16 text-red-500 mx-auto" />
      <h1 class="text-2xl font-bold text-gray-900">访问被拒绝</h1>
      <p class="text-gray-500">仅管理员可访问此页面</p>
      <button
        @click="goHome"
        class="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
      >
        返回首页
      </button>
    </div>
  </div>

  <!-- Admin Layout -->
  <div
    v-else
    class="min-h-screen relative overflow-hidden font-sans flex"
  >
    <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-[hsl(260_25%_6%)] dark:via-[hsl(260_20%_10%)] dark:to-[hsl(260_25%_8%)]"></div>

    <!-- Sidebar -->
    <AdminSidebar :is-open="isSidebarOpen" @toggle="toggleSidebar" />

    <!-- Main Content -->
    <main class="relative z-10 flex-1 flex flex-col min-w-0 overflow-hidden">
      <!-- Mobile Header -->
      <div class="lg:hidden h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200 flex items-center px-4 relative z-20">
        <button
          @click="toggleSidebar"
          class="p-2 -ml-2 text-gray-500"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
        </button>
        <span class="ml-4 text-lg font-semibold text-gray-900">管理后台</span>
      </div>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto p-4 lg:p-8">
        <div class="max-w-7xl mx-auto">
          <RouterView />
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
</style>
