<script setup lang="ts">
import { onMounted } from 'vue'
import { useAdminStore } from '@/stores/admin'
import StatisticsChart from '@/components/admin/StatisticsChart.vue'

const adminStore = useAdminStore()

onMounted(() => {
  adminStore.fetchStats()
})
</script>

<template>
  <div class="space-y-8">
    <div>
      <h2 class="text-3xl font-bold tracking-tight text-white">概览仪表盘</h2>
      <p class="text-white/70 mt-2">欢迎回来，这里是系统的实时运行状态与趋势分析。</p>
    </div>

    <StatisticsChart :stats="adminStore.stats" />
  </div>
</template>

<style scoped>
</style>
