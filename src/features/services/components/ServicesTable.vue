<script setup lang="ts">
import { ref } from 'vue'
import { DeleteOutlined, EditOutlined, EyeOutlined, HolderOutlined } from '@ant-design/icons-vue'
import type { TableColumnsType } from 'ant-design-vue'
import type { ServiceConfig } from '@/shared/types'
import CopyableDomain from '@/shared/ui/CopyableDomain.vue'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
const draggingServiceId = ref<string | null>(null)
const dragOverServiceId = ref<string | null>(null)

interface ServiceDragDataTransfer {
  effectAllowed: string
  dropEffect: string
  setData: (format: string, data: string) => void
  getData: (format: string) => string
}

interface ServiceDragEvent {
  currentTarget: unknown
  clientY: number
  dataTransfer?: ServiceDragDataTransfer | null
  preventDefault: () => void
}

defineEmits<{
  view: [serviceId: string]
  edit: [serviceId: string]
}>()

const columns: TableColumnsType<ServiceConfig> = [
  { title: '启用', key: 'enabled', width: 80, fixed: 'left' },
  { title: '名称', dataIndex: 'name', key: 'name', width: 220 },
  { title: '域名', dataIndex: 'domain', key: 'domain', width: 240 },
  { title: '备注', dataIndex: 'remark', key: 'remark', width: 220 },
  { title: '端口', dataIndex: 'port', key: 'port', width: 110 },
  { title: '隧道', dataIndex: 'tunnelId', key: 'tunnelId', width: 180 },
  { title: '操作', key: 'actions', width: 136, fixed: 'right' },
]

function customRow(record: ServiceConfig) {
  return {
    draggable: true,
    onDragstart: (event: ServiceDragEvent) => {
      draggingServiceId.value = record.id
      dragOverServiceId.value = null
      event.dataTransfer?.setData('text/plain', record.id)
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
      }
    },
    onDragover: (event: ServiceDragEvent) => {
      if (!draggingServiceId.value || !store.canReorderService(draggingServiceId.value, record.id)) return
      event.preventDefault()
      dragOverServiceId.value = record.id
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move'
      }
    },
    onDragleave: () => {
      if (dragOverServiceId.value === record.id) {
        dragOverServiceId.value = null
      }
    },
    onDrop: (event: ServiceDragEvent) => {
      event.preventDefault()
      const serviceId = draggingServiceId.value || event.dataTransfer?.getData('text/plain')
      if (serviceId) {
        store.reorderService(serviceId, record.id, dropPlacement(event))
      }
      draggingServiceId.value = null
      dragOverServiceId.value = null
    },
    onDragend: () => {
      draggingServiceId.value = null
      dragOverServiceId.value = null
    },
  }
}

function rowClassName(record: ServiceConfig) {
  return [
    'service-row',
    draggingServiceId.value === record.id ? 'service-row-dragging' : '',
    dragOverServiceId.value === record.id ? 'service-row-drop-target' : '',
  ].filter(Boolean).join(' ')
}

function dropPlacement(event: ServiceDragEvent) {
  const element = event.currentTarget as HTMLElement
  const rect = element.getBoundingClientRect()
  return event.clientY > rect.top + rect.height / 2 ? 'after' : 'before'
}
</script>

<template>
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
        :scroll="{ x: 1180 }"
        :custom-row="customRow"
        :row-class-name="rowClassName"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'enabled'">
            <a-tag :color="(record as ServiceConfig).enabled ? 'success' : 'default'">
              {{ (record as ServiceConfig).enabled ? '启用' : '停用' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'name'">
            <div class="flex min-w-0 items-center gap-2">
              <a-tooltip title="拖动排序">
                <HolderOutlined class="service-drag-handle" />
              </a-tooltip>
              <div class="min-w-0">
                <span class="block truncate" :title="(record as ServiceConfig).name">{{ (record as ServiceConfig).name }}</span>
                <span class="block truncate text-xs text-[var(--text-muted)]" :title="`${(record as ServiceConfig).group || '未分组'} / ${(record as ServiceConfig).localIp}`">
                  {{ (record as ServiceConfig).group || '未分组' }} / {{ (record as ServiceConfig).localIp }}
                </span>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'domain'">
            <CopyableDomain :value="(record as ServiceConfig).domain" />
          </template>
          <template v-else-if="column.key === 'remark'">
            <span class="block truncate text-xs text-[var(--text-muted)]" :title="(record as ServiceConfig).remark">
              {{ (record as ServiceConfig).remark || '-' }}
            </span>
          </template>
          <template v-else-if="column.key === 'port'">
            {{ (record as ServiceConfig).port }}
          </template>
          <template v-else-if="column.key === 'tunnelId'">
            <span class="block truncate" :title="store.tunnelName((record as ServiceConfig).tunnelId)">
              {{ store.tunnelName((record as ServiceConfig).tunnelId) }}
            </span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-space :size="0">
              <a-tooltip title="查看">
                <a-button type="text" @click="$emit('view', (record as ServiceConfig).id)">
                  <template #icon><EyeOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-tooltip title="编辑">
                <a-button type="text" @click="$emit('edit', (record as ServiceConfig).id)">
                  <template #icon><EditOutlined /></template>
                </a-button>
              </a-tooltip>
              <a-popconfirm title="删除这个服务？" ok-text="删除" cancel-text="取消" @confirm="store.removeService((record as ServiceConfig).id)">
                <a-tooltip title="删除">
                  <a-button danger type="text">
                    <template #icon><DeleteOutlined /></template>
                  </a-button>
                </a-tooltip>
              </a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<style scoped>
.service-drag-handle {
  flex: 0 0 auto;
  color: var(--text-muted);
  cursor: grab;
  font-size: 15px;
}

:deep(.service-row) {
  cursor: grab;
}

:deep(.service-row-dragging) {
  opacity: 0.45;
}

:deep(.service-row-drop-target td) {
  background: rgba(22, 119, 255, 0.08) !important;
}
</style>
