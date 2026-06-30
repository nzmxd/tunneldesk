<script setup lang="ts">
import { ReloadOutlined } from '@ant-design/icons-vue'
import { runningLabel } from '@/shared/domain/serviceStatus'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
</script>

<template>
  <a-card :bordered="false" class="surface-card">
    <template #title>
      <div class="card-title">
        <span class="card-title-main">诊断</span>
      </div>
    </template>
    <a-alert
      v-if="!store.status.isAdmin"
      class="mb-4"
      type="warning"
      show-icon
      message="当前不是管理员权限"
    />
    <a-descriptions bordered size="small" :column="1">
      <a-descriptions-item label="管理员权限">
        <a-tag :color="store.status.isAdmin ? 'success' : 'warning'">
          {{ store.status.isAdmin ? 'OK' : '需要管理员启动' }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="hosts 标记块">
        <a-tag :color="store.status.hostsBlockPresent ? 'processing' : 'success'">
          {{ store.status.hostsBlockPresent ? '存在' : '不存在' }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="运行状态">
        {{ runningLabel(store.status.running) }}
      </a-descriptions-item>
      <a-descriptions-item label="运行隧道">
        {{ store.status.runningTunnelIds.map(store.tunnelName).join(', ') || '无' }}
      </a-descriptions-item>
    </a-descriptions>
    <div class="mt-4 flex justify-end">
      <a-button :loading="store.loading" @click="store.repairHosts">
        <template #icon><ReloadOutlined /></template>
        修复 hosts
      </a-button>
    </div>
  </a-card>
</template>
