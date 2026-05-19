<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    const result = await authStore.login(username.value, password.value)
    if (result.success) {
      const redirect = route.query.redirect as string || '/dashboard'
      router.push(redirect)
    } else {
      error.value = result.error || '登录失败'
    }
  } finally {
    loading.value = false
  }
}

const goToRegister = () => {
  router.push('/auth/register')
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden flex items-center justify-center text-white">
    <div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
    <div class="relative z-10 w-full max-w-md mx-4">
      <div class="bg-black/20 backdrop-blur-xl border border-white/20 rounded-2xl p-8">
        <h1 class="text-2xl font-bold text-center mb-6">登录</h1>
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-sm text-white/70 mb-1">用户名</label>
            <input
              v-model="username"
              type="text"
              class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label class="block text-sm text-white/70 mb-1">密码</label>
            <input
              v-model="password"
              type="password"
              class="w-full bg-black/20 border border-white/20 text-white placeholder:text-white/50 focus:ring-1 focus:ring-white/30 focus:border-white/40 rounded-md px-3 py-2"
              placeholder="请输入密码"
            />
          </div>
          <p v-if="error" class="text-red-400 text-sm">{{ error }}</p>
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2 rounded-lg bg-white/20 border border-white/20 text-white hover:bg-white/30 disabled:opacity-50"
          >
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </form>
        <p class="text-center text-white/60 text-sm mt-4">
          还没有账号？
          <button @click="goToRegister" class="text-white hover:underline">注册</button>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
