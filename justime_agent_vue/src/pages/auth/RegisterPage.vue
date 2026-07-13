<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const username = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const handleRegister = async () => {
  loading.value = true
  error.value = ''
  try {
    // For now, just redirect to login
    router.push('/auth/login')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden flex items-center justify-center">
    <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-indigo-50 dark:from-[hsl(260_25%_6%)] dark:via-[hsl(260_20%_10%)] dark:to-[hsl(260_25%_8%)]"></div>
    <div class="relative z-10 w-full max-w-md mx-4">
      <div class="bg-white backdrop-blur-xl border border-purple-100 shadow-lg rounded-2xl p-8">
        <h1 class="text-2xl font-bold text-center mb-6 text-gray-900">注册</h1>
        <form @submit.prevent="handleRegister" class="space-y-4">
          <div>
            <label class="block text-sm text-gray-600 mb-1">用户名</label>
            <input
              v-model="username"
              type="text"
              class="w-full bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-md px-3 py-2"
              placeholder="请输入用户名"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">邮箱</label>
            <input
              v-model="email"
              type="email"
              class="w-full bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-md px-3 py-2"
              placeholder="请输入邮箱"
            />
          </div>
          <div>
            <label class="block text-sm text-gray-600 mb-1">密码</label>
            <input
              v-model="password"
              type="password"
              class="w-full bg-white border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-purple-500 focus:border-purple-500 rounded-md px-3 py-2"
              placeholder="请输入密码"
            />
          </div>
          <p v-if="error" class="text-red-500 text-sm">{{ error }}</p>
          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 shadow-sm"
          >
            {{ loading ? '注册中...' : '注册' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
