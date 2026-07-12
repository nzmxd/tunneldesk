<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  FundOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons-vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import { useAppStore } from '@/stores/appStore'
import { useUpdateStore } from '@/stores/updateStore'
import MetricsGrid from './components/MetricsGrid.vue'
import ServiceStatusTable from './components/ServiceStatusTable.vue'
import StatusHero from './components/StatusHero.vue'
import QuickActions from './components/QuickActions.vue'

const store = useAppStore()
const updateStore = useUpdateStore()
const router = useRouter()
const affectedTunnelCount = computed(() => store.status.runningTunnelIds.length)
</script>

<template>
  <PageHeader title="工作台" description="查看连接状态并管理当前 Profile">
    <template #actions>
      <a-button
        v-if="updateStore.hasAvailableUpdate"
        size="large"
        type="primary"
        ghost
        :loading="updateStore.installing"
        :disabled="store.loading"
        @click="updateStore.installAvailableUpdate"
      >
        <template #icon><VerticalAlignTopOutlined /></template>
        {{ updateStore.installButtonText }}
      </a-button>
      <a-button size="large" :disabled="store.loading" @click="store.reload">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>
      <a-button size="large" :disabled="store.loading" @click="router.push({ name: 'diagnostics' })">
        <template #icon><FundOutlined /></template>
        诊断
      </a-button>
      <a-button v-if="!store.status.running" size="large" type="primary" :loading="store.loading" @click="store.start">
        <template #icon><PlayCircleOutlined /></template>
        启动
      </a-button>
      <a-popconfirm
        v-else
        title="停止当前 Profile？"
        :description="`将中断 ${affectedTunnelCount} 条运行隧道。`"
        ok-text="停止"
        cancel-text="取消"
        :ok-button-props="{ danger: true }"
        @confirm="store.stop"
      >
        <a-button size="large" danger :loading="store.loading">
          <template #icon><PauseCircleOutlined /></template>
          停止
        </a-button>
      </a-popconfirm>
    </template>
  </PageHeader>
  <div class="grid gap-4">
    <StatusHero />
    <MetricsGrid />
    <div class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.75fr)]">
      <ServiceStatusTable />
      <QuickActions />
    </div>
  </div>
</template>
