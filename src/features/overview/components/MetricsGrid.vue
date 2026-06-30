<script setup lang="ts">
import { computed } from 'vue'
import { ApiOutlined, DatabaseOutlined, SafetyCertificateOutlined, ThunderboltOutlined } from '@ant-design/icons-vue'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()

const metrics = computed(() => [
  {
    key: 'running',
    label: '运行状态',
    value: store.status.running ? '运行中' : '已停止',
    icon: ThunderboltOutlined,
    tone: store.status.running ? 'emerald' : 'amber',
  },
  {
    key: 'services',
    label: '启用服务',
    value: store.activeServices.length,
    icon: DatabaseOutlined,
    tone: 'blue',
  },
  {
    key: 'tunnels',
    label: '运行隧道',
    value: store.status.runningTunnelIds.length,
    icon: ApiOutlined,
    tone: 'violet',
  },
  {
    key: 'hosts',
    label: 'hosts',
    value: store.status.hostsBlockPresent ? '已写入' : '干净',
    icon: SafetyCertificateOutlined,
    tone: store.status.hostsBlockPresent ? 'blue' : 'emerald',
  },
])
</script>

<template>
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
    <a-card v-for="metric in metrics" :key="metric.key" :bordered="false" class="metric-card">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-medium text-[var(--text-muted)]">{{ metric.label }}</div>
          <div class="mt-2 truncate text-2xl font-semibold leading-8 text-[var(--text-primary)]">{{ metric.value }}</div>
        </div>
        <div
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-lg"
          :class="{
            'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300': metric.tone === 'emerald',
            'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300': metric.tone === 'blue',
            'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300': metric.tone === 'violet',
            'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300': metric.tone === 'amber',
          }"
        >
          <component :is="metric.icon" />
        </div>
      </div>
    </a-card>
  </div>
</template>
