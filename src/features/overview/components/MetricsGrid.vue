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
  },
  {
    key: 'services',
    label: '启用服务',
    value: store.activeServices.length,
    icon: DatabaseOutlined,
  },
  {
    key: 'tunnels',
    label: '运行隧道',
    value: store.status.runningTunnelIds.length,
    icon: ApiOutlined,
  },
  {
    key: 'hosts',
    label: 'hosts',
    value: store.status.hostsBlockPresent ? '已写入' : '干净',
    icon: SafetyCertificateOutlined,
  },
])
</script>

<template>
  <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
    <a-card v-for="metric in metrics" :key="metric.key" :bordered="false">
      <div class="flex items-center justify-between gap-3">
        <a-statistic :title="metric.label" :value="metric.value" />
        <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-lg text-emerald-700 dark:bg-emerald-950/40">
          <component :is="metric.icon" />
        </div>
      </div>
    </a-card>
  </div>
</template>
