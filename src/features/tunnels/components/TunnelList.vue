<script setup lang="ts">
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import type { TunnelConfig } from '@/shared/types'

defineProps<{
  tunnels: TunnelConfig[]
  currentTunnelId: string
  runningTunnelIds: string[]
}>()

const emit = defineEmits<{
  select: [tunnelId: string]
  add: []
  remove: [tunnelId: string]
}>()
</script>

<template>
  <a-card title="隧道列表" :bordered="false" class="h-fit">
    <div class="grid gap-2">
      <button
        v-for="tunnel in tunnels"
        :key="tunnel.id"
        type="button"
        class="w-full rounded-md border px-3 py-2 text-left transition hover:border-emerald-600"
        :class="tunnel.id === currentTunnelId ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-800'"
        @click="emit('select', tunnel.id)"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate font-medium text-slate-950 dark:text-slate-100">{{ tunnel.name }}</div>
            <div class="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
              {{ tunnel.ssh.host || '未配置 Host' }}:{{ tunnel.ssh.port }}
            </div>
          </div>
          <a-tag :color="runningTunnelIds.includes(tunnel.id) ? 'success' : tunnel.enabled ? 'default' : 'warning'">
            {{ runningTunnelIds.includes(tunnel.id) ? '运行' : tunnel.enabled ? '停止' : '禁用' }}
          </a-tag>
        </div>
      </button>
    </div>
    <div class="mt-4 grid gap-2 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2">
      <a-button block @click="emit('add')">
        <template #icon><PlusOutlined /></template>
        添加
      </a-button>
      <a-button block danger @click="emit('remove', currentTunnelId)">
        <template #icon><DeleteOutlined /></template>
        删除
      </a-button>
    </div>
  </a-card>
</template>
