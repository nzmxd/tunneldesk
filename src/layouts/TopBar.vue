<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons-vue'
import { runningLabel } from '@/shared/domain/serviceStatus'
import { useAppStore } from '@/stores/appStore'
import { useUpdateStore } from '@/stores/updateStore'

const store = useAppStore()
const updateStore = useUpdateStore()
const route = useRoute()

const pageTitle = computed(() => String(route.meta.title || 'TunnelDesk'))
const runningText = computed(() => runningLabel(store.status.running))
const activeSummary = computed(() => {
  return `${store.activeServices.length} 个启用服务 / ${store.profileTunnelIds.length} 条隧道`
})
</script>

<template>
  <div
    class="topbar flex shrink-0 items-center justify-between gap-4 overflow-hidden border-b border-[var(--line-soft)] bg-[var(--topbar-bg)] px-4 md:px-5"
  >
    <div class="flex min-w-0 flex-col justify-center">
      <div class="flex min-w-0 items-center gap-2 text-xs text-[var(--text-muted)]">
        <span class="shrink-0">TunnelDesk</span>
        <span>/</span>
        <span class="truncate font-medium text-[var(--text-secondary)]">{{ pageTitle }}</span>
      </div>
      <div class="mt-1 flex min-w-0 items-center gap-2 overflow-hidden">
        <a-tag class="status-chip" :color="store.status.running ? 'success' : 'warning'">
          <template #icon>
            <CheckCircleOutlined v-if="store.status.running" />
            <PauseCircleOutlined v-else />
          </template>
          {{ runningText }}
        </a-tag>
        <a-tag class="status-chip optional-status-chip" :color="store.status.isAdmin ? 'success' : 'warning'">
          <template #icon>
            <CheckCircleOutlined v-if="store.status.isAdmin" />
            <CloseCircleOutlined v-else />
          </template>
          {{ store.status.isAdmin ? '管理员权限' : '非管理员' }}
        </a-tag>
        <span class="min-w-0 truncate text-sm text-[var(--text-muted)]">{{ activeSummary }}</span>
      </div>
    </div>

    <div class="topbar-actions flex shrink-0 items-center justify-end gap-2">
      <a-button
        v-if="updateStore.hasAvailableUpdate"
        type="primary"
        ghost
        :loading="updateStore.installing"
        :disabled="store.loading"
        @click="updateStore.installAvailableUpdate"
      >
        <template #icon><VerticalAlignTopOutlined /></template>
        {{ updateStore.installButtonText }}
      </a-button>
      <a-button :disabled="store.loading" @click="store.reload">
        <template #icon><ReloadOutlined /></template>
        刷新
      </a-button>
      <a-button v-if="!store.status.running" type="primary" :loading="store.loading" @click="store.start">
        <template #icon><PlayCircleOutlined /></template>
        启动
      </a-button>
      <a-button v-else danger :loading="store.loading" @click="store.stop">
        <template #icon><PauseCircleOutlined /></template>
        停止
      </a-button>
    </div>
  </div>
</template>
