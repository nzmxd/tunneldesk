<script setup lang="ts">
import { DeleteOutlined } from '@ant-design/icons-vue'
import type { TableColumnsType } from 'ant-design-vue'
import type { ServiceConfig } from '@/shared/types'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()

const columns: TableColumnsType<ServiceConfig> = [
  { title: '启用', key: 'enabled', width: 80, fixed: 'left' },
  { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
  { title: '域名', dataIndex: 'domain', key: 'domain', width: 240 },
  { title: '端口', dataIndex: 'port', key: 'port', width: 110 },
  { title: '本地 IP', dataIndex: 'localIp', key: 'localIp', width: 150 },
  { title: '隧道', dataIndex: 'tunnelId', key: 'tunnelId', width: 180 },
  { title: '操作', key: 'actions', width: 90, fixed: 'right' },
]
</script>

<template>
  <a-table
    size="small"
    row-key="id"
    :columns="columns"
    :data-source="store.currentProfile.services"
    :pagination="false"
    :scroll="{ x: 1010 }"
  >
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'enabled'">
        <a-switch v-model:checked="(record as ServiceConfig).enabled" size="small" />
      </template>
      <template v-else-if="column.key === 'name'">
        <a-input v-model:value="(record as ServiceConfig).name" />
      </template>
      <template v-else-if="column.key === 'domain'">
        <a-input v-model:value="(record as ServiceConfig).domain" />
      </template>
      <template v-else-if="column.key === 'port'">
        <a-input-number v-model:value="(record as ServiceConfig).port" class="w-full" :min="1" :max="65535" />
      </template>
      <template v-else-if="column.key === 'localIp'">
        <a-input v-model:value="(record as ServiceConfig).localIp" />
      </template>
      <template v-else-if="column.key === 'tunnelId'">
        <a-select v-model:value="(record as ServiceConfig).tunnelId" class="w-full">
          <a-select-option v-for="tunnel in store.settings.tunnels" :key="tunnel.id" :value="tunnel.id">
            {{ tunnel.name }}
          </a-select-option>
        </a-select>
      </template>
      <template v-else-if="column.key === 'actions'">
        <a-popconfirm title="删除这个服务？" ok-text="删除" cancel-text="取消" @confirm="store.removeService((record as ServiceConfig).id)">
          <a-button danger type="text">
            <template #icon><DeleteOutlined /></template>
          </a-button>
        </a-popconfirm>
      </template>
    </template>
  </a-table>
</template>
