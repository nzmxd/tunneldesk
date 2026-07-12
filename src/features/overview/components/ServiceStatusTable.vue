<script setup lang="ts">
import { computed } from 'vue'
import type { TableColumnsType } from 'ant-design-vue'
import { ArrowRightOutlined, ImportOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'
import StatusTag from '@/shared/ui/StatusTag.vue'
import CopyableDomain from '@/shared/ui/CopyableDomain.vue'
import { serviceStatusFor } from '@/shared/domain/serviceStatus'
import { useAppStore } from '@/stores/appStore'
import type { ServiceConfig } from '@/shared/types'
import EmptyState from '@/shared/ui/EmptyState.vue'

const store = useAppStore()
const router = useRouter()
const visibleServices = computed(() => store.orderedCurrentServices.slice(0, 5))

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
  <a-card :bordered="false" class="surface-card h-full">
    <template #title>
      <div class="card-title">
        <span class="card-title-main">服务状态</span>
        <span class="card-title-meta">{{ store.orderedCurrentServices.length }} 个服务</span>
      </div>
    </template>
    <div v-if="visibleServices.length" class="grid gap-3">
      <section class="overflow-hidden rounded-lg border border-[var(--line-soft)]">
        <a-table
          size="small"
          row-key="id"
          :columns="columns"
          :data-source="visibleServices"
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
      <div class="flex justify-end">
        <a-button type="link" @click="router.push({ name: 'services' })">
          查看全部服务
          <template #icon><ArrowRightOutlined /></template>
        </a-button>
      </div>
    </div>
    <EmptyState v-else description="当前 Profile 还没有服务配置">
      <template #actions>
        <a-button @click="router.push({ name: 'tunnels', query: { action: 'create' } })">
          <template #icon><PlusOutlined /></template>
          添加隧道
        </a-button>
        <a-button type="primary" @click="router.push({ name: 'services', query: { action: 'import' } })">
          <template #icon><ImportOutlined /></template>
          导入服务配置
        </a-button>
      </template>
    </EmptyState>
  </a-card>
</template>
