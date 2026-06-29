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
    class="topbar flex h-[76px] shrink-0 items-center justify-between gap-4 overflow-hidden border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-[#171c22] lg:px-6"
  >
    <div class="flex min-w-0 items-center gap-4">
      <h1 class="m-0 shrink-0 text-xl font-semibold leading-7 text-slate-950 dark:text-slate-100">{{ pageTitle }}</h1>
      <div class="flex min-w-0 items-center gap-2 overflow-hidden">
        <a-tag :color="store.status.running ? 'success' : 'warning'">
          <template #icon>
            <CheckCircleOutlined v-if="store.status.running" />
            <PauseCircleOutlined v-else />
          </template>
          {{ runningText }}
        </a-tag>
        <a-tag :color="store.status.isAdmin ? 'success' : 'warning'">
          <template #icon>
            <CheckCircleOutlined v-if="store.status.isAdmin" />
            <CloseCircleOutlined v-else />
          </template>
          {{ store.status.isAdmin ? '管理员权限' : '非管理员' }}
        </a-tag>
        <span class="min-w-0 truncate text-sm text-slate-500 dark:text-slate-400">{{ activeSummary }}</span>
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
