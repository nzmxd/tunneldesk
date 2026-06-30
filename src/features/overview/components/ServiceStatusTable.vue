<script setup lang="ts">
import { computed } from 'vue'
import type { TableColumnsType } from 'ant-design-vue'
import StatusTag from '@/shared/ui/StatusTag.vue'
import { serviceStatusFor } from '@/shared/domain/serviceStatus'
import { useAppStore } from '@/stores/appStore'
import type { ServiceConfig } from '@/shared/types'

const store = useAppStore()

const columns: TableColumnsType<ServiceConfig> = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '域名', dataIndex: 'domain', key: 'domain', ellipsis: true },
  { title: '端口', dataIndex: 'port', key: 'port', width: 90 },
  { title: '隧道', dataIndex: 'tunnelId', key: 'tunnelId', width: 150 },
  { title: '状态', key: 'state', width: 120, fixed: 'right' },
]

const services = computed(() => store.currentProfile.services)

function statusFor(record: ServiceConfig) {
  return serviceStatusFor(record.id, store.status.services)
}
</script>

<template>
  <a-card :bordered="false" class="surface-card">
    <template #title>
      <div class="card-title">
        <span class="card-title-main">服务状态</span>
        <span class="card-title-meta">{{ services.length }} 个服务</span>
      </div>
    </template>
    <a-table
      size="small"
      row-key="id"
      :columns="columns"
      :data-source="services"
      :pagination="false"
      :scroll="{ x: 'max-content' }"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'domain'">
          <span class="mono text-xs">{{ (record as ServiceConfig).domain }}</span>
        </template>
        <template v-else-if="column.key === 'tunnelId'">
          {{ store.tunnelName((record as ServiceConfig).tunnelId) }}
        </template>
        <template v-else-if="column.key === 'state'">
          <StatusTag :state="statusFor(record as ServiceConfig)?.state" />
        </template>
      </template>
    </a-table>
  </a-card>
</template>
