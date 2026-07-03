<script setup lang="ts">
import type { TableColumnsType } from 'ant-design-vue'
import StatusTag from '@/shared/ui/StatusTag.vue'
import CopyableDomain from '@/shared/ui/CopyableDomain.vue'
import { serviceStatusFor } from '@/shared/domain/serviceStatus'
import { useAppStore } from '@/stores/appStore'
import type { ServiceConfig } from '@/shared/types'

const store = useAppStore()

const columns: TableColumnsType<ServiceConfig> = [
  { title: '名称', dataIndex: 'name', key: 'name', width: 220 },
  { title: '域名', dataIndex: 'domain', key: 'domain', width: 240 },
  { title: '端口', dataIndex: 'port', key: 'port', width: 90 },
  { title: '隧道', dataIndex: 'tunnelId', key: 'tunnelId', width: 180 },
  { title: '状态', key: 'state', width: 120, fixed: 'right' },
]

function statusFor(record: ServiceConfig) {
  return serviceStatusFor(record.id, store.status.services)
}
</script>

<template>
  <a-card :bordered="false" class="surface-card">
    <template #title>
      <div class="card-title">
        <span class="card-title-main">服务状态</span>
        <span class="card-title-meta">{{ store.orderedCurrentServices.length }} 个服务</span>
      </div>
    </template>
    <div class="grid gap-4">
      <section v-for="group in store.serviceGroups" :key="group.key" class="overflow-hidden rounded-md border border-[var(--line-soft)]">
        <div class="flex min-h-10 items-center justify-between gap-3 border-b border-[var(--line-soft)] px-3">
          <div class="min-w-0 font-medium text-[var(--text-primary)]">{{ group.label }}</div>
          <div class="shrink-0 text-xs text-[var(--text-muted)]">{{ group.services.length }} 个服务</div>
        </div>
        <a-table
          size="small"
          row-key="id"
          :columns="columns"
          :data-source="group.services"
          :pagination="false"
          :scroll="{ x: 850 }"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="min-w-0">
                <span class="block truncate" :title="(record as ServiceConfig).name">{{ (record as ServiceConfig).name }}</span>
                <span class="block truncate text-xs text-[var(--text-muted)]" :title="`${(record as ServiceConfig).group || '未分组'} / ${(record as ServiceConfig).localIp}`">
                  {{ (record as ServiceConfig).group || '未分组' }} / {{ (record as ServiceConfig).localIp }}
                </span>
              </div>
            </template>
            <template v-else-if="column.key === 'domain'">
              <CopyableDomain :value="(record as ServiceConfig).domain" mono />
            </template>
            <template v-else-if="column.key === 'tunnelId'">
              <span class="block truncate" :title="store.tunnelName((record as ServiceConfig).tunnelId)">
                {{ store.tunnelName((record as ServiceConfig).tunnelId) }}
              </span>
            </template>
            <template v-else-if="column.key === 'state'">
              <StatusTag :state="statusFor(record as ServiceConfig)?.state" />
            </template>
          </template>
        </a-table>
      </section>
    </div>
  </a-card>
</template>
