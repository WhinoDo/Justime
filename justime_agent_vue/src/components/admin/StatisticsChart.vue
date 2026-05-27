<script setup lang="ts">
import { computed } from 'vue'
import type { AdminStats, TrendPoint } from '@/types/admin'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  MessageSquare,
  Users,
  Zap
} from 'lucide-vue-next'

interface Props {
  stats: AdminStats | null
}

const props = defineProps<Props>()

// Build mock trend data for visualization
const trendData = computed((): TrendPoint[] => {
  const stats = props.stats
  const totalUsers = Math.max(0, Number(stats?.total_users || 0))
  const activeUsers = Math.max(0, Number(stats?.active_users || 0))
  const totalTokens = Math.max(0, Number(stats?.total_tokens || 0))

  const tokenBase = Math.max(200, Math.floor(totalTokens / 7) || 1200)
  const activeBase = Math.max(10, activeUsers || Math.floor(totalUsers * 0.65) || 30)
  const newUserBase = Math.max(1, Math.floor(totalUsers * 0.012) || 2)

  const tokenFactors = [0.82, 0.93, 1.01, 1.14, 0.97, 1.08, 1.2]
  const activeFactors = [0.89, 0.92, 0.97, 1.02, 0.99, 1.04, 1.08]
  const newUserFactors = [0.8, 1.0, 0.9, 1.2, 1.1, 1.0, 1.3]

  const now = new Date()
  const rows: TrendPoint[] = []

  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const idx = 6 - i

    rows.push({
      date: label,
      tokens: Math.round(tokenBase * tokenFactors[idx]),
      newUsers: Math.max(1, Math.round(newUserBase * newUserFactors[idx])),
      activeUsers: Math.max(1, Math.round(activeBase * activeFactors[idx]))
    })
  }

  return rows
})

const formatTokens = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return `${value}`
}

const maxTokens = computed(() => Math.max(...trendData.value.map(d => d.tokens)))
const maxUsers = computed(() => Math.max(...trendData.value.map(d => Math.max(d.newUsers, d.activeUsers))))
</script>

<template>
  <div class="space-y-8">
    <!-- Stat Cards -->
    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <!-- Total Users -->
      <div class="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl transition-all hover:bg-white/20 hover:border-white/30">
        <div class="flex flex-row items-center justify-between pb-2">
          <p class="text-sm font-medium text-white/70">总用户数</p>
          <Users class="h-4 w-4 text-white/50" />
        </div>
        <div>
          <div class="text-2xl font-bold text-white">{{ stats?.total_users || 0 }}</div>
          <div class="flex items-center text-xs mt-1">
            <ArrowUpRight class="h-4 w-4 text-green-400 mr-1" />
            <span class="text-green-400">+12.5%</span>
            <span class="text-white/60 ml-1">较上月</span>
          </div>
        </div>
      </div>

      <!-- Active Users -->
      <div class="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl transition-all hover:bg-white/20 hover:border-white/30">
        <div class="flex flex-row items-center justify-between pb-2">
          <p class="text-sm font-medium text-white/70">活跃用户</p>
          <Activity class="h-4 w-4 text-white/50" />
        </div>
        <div>
          <div class="text-2xl font-bold text-white">{{ stats?.active_users || 0 }}</div>
          <div class="flex items-center text-xs mt-1">
            <ArrowUpRight class="h-4 w-4 text-green-400 mr-1" />
            <span class="text-green-400">+4.3%</span>
            <span class="text-white/60 ml-1">较上周</span>
          </div>
        </div>
      </div>

      <!-- Total Conversations -->
      <div class="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl transition-all hover:bg-white/20 hover:border-white/30">
        <div class="flex flex-row items-center justify-between pb-2">
          <p class="text-sm font-medium text-white/70">总对话数</p>
          <MessageSquare class="h-4 w-4 text-white/50" />
        </div>
        <div>
          <div class="text-2xl font-bold text-white">{{ stats?.total_conversations?.toLocaleString() || 0 }}</div>
          <div class="flex items-center text-xs mt-1">
            <ArrowUpRight class="h-4 w-4 text-green-400 mr-1" />
            <span class="text-green-400">+28.4%</span>
            <span class="text-white/60 ml-1">较昨日</span>
          </div>
        </div>
      </div>

      <!-- Token Consumption -->
      <div class="p-6 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl transition-all hover:bg-white/20 hover:border-white/30">
        <div class="flex flex-row items-center justify-between pb-2">
          <p class="text-sm font-medium text-white/70">Token 消耗</p>
          <Zap class="h-4 w-4 text-white/50" />
        </div>
        <div>
          <div class="text-2xl font-bold text-white">
            {{ stats?.total_tokens ? `${(stats.total_tokens / 1_000_000).toFixed(1)}M` : '0' }}
          </div>
          <div class="flex items-center text-xs mt-1">
            <ArrowDownRight class="h-4 w-4 text-red-300 mr-1" />
            <span class="text-red-300">-2.1%</span>
            <span class="text-white/60 ml-1">较上周</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <!-- Token Trend Chart -->
      <div class="xl:col-span-3 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl p-4 lg:p-6">
        <div class="mb-4">
          <h3 class="text-white text-lg font-semibold">近 7 天 Token 消耗趋势</h3>
          <p class="text-white/60 text-xs mt-1">基于当前总量推演的日级趋势，用于可视化预览</p>
        </div>
        <div class="h-[280px]">
          <!-- Simple bar chart visualization -->
          <div class="h-full flex items-end gap-2 px-4">
            <div
              v-for="point in trendData"
              :key="point.date"
              class="flex-1 flex flex-col items-center"
            >
              <div
                class="w-full bg-blue-500/60 rounded-t transition-all hover:bg-blue-400/80"
                :style="{ height: `${(point.tokens / maxTokens) * 240}px` }"
              ></div>
              <span class="text-xs text-white/60 mt-2">{{ point.date }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- User Growth Chart -->
      <div class="xl:col-span-2 rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl p-4 lg:p-6">
        <div class="mb-4">
          <h3 class="text-white text-lg font-semibold">用户增长与活跃</h3>
          <p class="text-white/60 text-xs mt-1">近 7 天新增用户与活跃用户对比</p>
        </div>
        <div class="h-[280px]">
          <!-- Simple grouped bar chart -->
          <div class="h-full flex items-end gap-4 px-2">
            <div
              v-for="point in trendData"
              :key="point.date"
              class="flex-1 flex flex-col items-center"
            >
              <div class="flex gap-1 items-end h-[240px]">
                <div
                  class="w-3 bg-emerald-400/70 rounded-t transition-all hover:bg-emerald-300"
                  :style="{ height: `${(point.newUsers / maxUsers) * 200}px` }"
                ></div>
                <div
                  class="w-3 bg-sky-400/70 rounded-t transition-all hover:bg-sky-300"
                  :style="{ height: `${(point.activeUsers / maxUsers) * 200}px` }"
                ></div>
              </div>
              <span class="text-xs text-white/60 mt-2">{{ point.date }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- System Status -->
    <div class="rounded-2xl border border-white/20 bg-white/5 backdrop-blur-xl shadow-2xl p-4 lg:p-6">
      <h3 class="text-white text-lg font-semibold">系统状态概览</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
        <div class="flex flex-col space-y-2 p-4 bg-white/10 border border-white/15 rounded-lg">
          <span class="text-sm font-medium text-white/70">后端版本</span>
          <span class="text-lg font-bold text-white">{{ stats?.version || 'Unknown' }}</span>
        </div>
        <div class="flex flex-col space-y-2 p-4 bg-white/10 border border-white/15 rounded-lg">
          <span class="text-sm font-medium text-white/70">数据库连接</span>
          <span class="flex items-center text-lg text-green-400 font-semibold">
            <div class="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
            正常
          </span>
        </div>
        <div class="flex flex-col space-y-2 p-4 bg-white/10 border border-white/15 rounded-lg">
          <span class="text-sm font-medium text-white/70">LLM 服务</span>
          <span class="flex items-center text-lg text-green-400 font-semibold">
            <div class="w-2 h-2 rounded-full bg-green-400 mr-2"></div>
            运行中
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
