<script setup lang="ts">
import { computed, type Component } from 'vue'
import { ApiOutlined, CheckCircleOutlined, DatabaseOutlined, WarningOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/appStore'
import { buildOverviewSummary } from '../overviewState'

const store = useAppStore()
const router = useRouter()
const summary = computed(() => buildOverviewSummary(store.currentProfile, store.settings, store.status))

const metrics = computed<{ key: string; label: string; value: number; icon: Component; tone: string; route: string }[]>(() => [
  {
    key: 'services',
    label: '启用服务',
    value: summary.value.enabledServices,
    icon: DatabaseOutlined,
    tone: 'blue',
    route: 'services',
  },
  {
    key: 'tunnels',
    label: '运行隧道',
    value: summary.value.runningTunnels,
    icon: ApiOutlined,
    tone: 'cyan',
    route: 'tunnels',
  },
  {
    key: 'healthy',
    label: '健康域名',
    value: summary.value.healthyServices,
    icon: CheckCircleOutlined,
    tone: 'emerald',
    route: 'services',
  },
  {
    key: 'abnormal',
    label: '异常服务',
    value: summary.value.abnormalServices,
    icon: WarningOutlined,
    tone: summary.value.abnormalServices ? 'red' : 'neutral',
    route: 'diagnostics',
  },
])
</script>

<template>
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
    <button
      v-for="metric in metrics"
      :key="metric.key"
      type="button"
      class="metric-card app-panel interactive-row text-left"
      @click="router.push({ name: metric.route })"
    >
      <div class="flex items-center gap-4">
        <div
          class="metric-icon flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[25px]"
          :class="{
            'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300': metric.tone === 'emerald',
            'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300': metric.tone === 'blue',
            'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300': metric.tone === 'cyan',
            'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300': metric.tone === 'red',
            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300': metric.tone === 'neutral',
          }"
        >
          <component :is="metric.icon" />
        </div>
        <div class="min-w-0">
          <div class="text-sm font-medium text-[var(--text-muted)]">{{ metric.label }}</div>
          <div class="mt-1 truncate text-[28px] font-semibold leading-8 text-[var(--text-primary)]">{{ metric.value }}</div>
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.metric-card {
  min-height: 106px;
  cursor: pointer;
  padding: 18px 20px;
}

.metric-card:hover {
  border-color: rgba(37, 99, 235, 0.32);
  transform: translateY(-1px);
}
</style>
