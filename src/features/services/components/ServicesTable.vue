<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { DeleteOutlined, EditOutlined, ExclamationCircleOutlined, EyeOutlined, HolderOutlined, MoreOutlined } from '@ant-design/icons-vue'
import { App, type TableColumnsType } from 'ant-design-vue'
import type { ServiceConfig } from '@/shared/types'
import CopyableDomain from '@/shared/ui/CopyableDomain.vue'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
const { modal } = App.useApp()
const draggingServiceId = ref<string | null>(null)
const dragOverServiceId = ref<string | null>(null)

interface ServicePointerEvent {
  button: number
  clientX: number
  clientY: number
  currentTarget: HTMLElement | null
  pointerId: number
  preventDefault: () => void
}

interface ServiceKeyboardEvent {
  key: string
  preventDefault: () => void
}

const draggingPointerId = ref<number | null>(null)

const props = defineProps<{
  visibleServiceIds?: string[]
}>()

const visibleIdSet = computed(() => new Set(props.visibleServiceIds || store.orderedCurrentServices.map((service) => service.id)))
const visibleGroups = computed(() =>
  store.serviceGroups
    .map((group) => ({ ...group, services: group.services.filter((service) => visibleIdSet.value.has(service.id)) }))
    .filter((group) => group.services.length),
)

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

function beginPointerDrag(record: ServiceConfig, event: unknown) {
  const pointerEvent = event as ServicePointerEvent
  if (pointerEvent.button !== 0 || !pointerEvent.currentTarget) return
  pointerEvent.preventDefault()
  pointerEvent.currentTarget.setPointerCapture(pointerEvent.pointerId)
  draggingServiceId.value = record.id
  dragOverServiceId.value = null
  draggingPointerId.value = pointerEvent.pointerId
}

function updatePointerDrag(event: unknown) {
  const pointerEvent = event as ServicePointerEvent
  if (draggingPointerId.value !== pointerEvent.pointerId || !draggingServiceId.value) return
  pointerEvent.preventDefault()
  const targetId = serviceIdAtPoint(pointerEvent)
  dragOverServiceId.value = targetId && store.canReorderService(draggingServiceId.value, targetId) ? targetId : null
}

function endPointerDrag(event: unknown) {
  const pointerEvent = event as ServicePointerEvent
  if (draggingPointerId.value !== pointerEvent.pointerId) return
  const sourceId = draggingServiceId.value
  const targetId = dragOverServiceId.value || serviceIdAtPoint(pointerEvent)
  if (sourceId && targetId && store.canReorderService(sourceId, targetId)) {
    store.reorderService(sourceId, targetId, dropPlacement(targetId, pointerEvent.clientY))
  }
  if (pointerEvent.currentTarget?.hasPointerCapture(pointerEvent.pointerId)) {
    pointerEvent.currentTarget.releasePointerCapture(pointerEvent.pointerId)
  }
  clearPointerDrag()
}

function cancelPointerDrag(event: unknown) {
  const pointerEvent = event as ServicePointerEvent
  if (draggingPointerId.value !== pointerEvent.pointerId) return
  clearPointerDrag()
}

function clearPointerDrag() {
  draggingServiceId.value = null
  dragOverServiceId.value = null
  draggingPointerId.value = null
}

function serviceIdAtPoint(event: ServicePointerEvent) {
  const element = globalThis.document.elementFromPoint(event.clientX, event.clientY)
  const row = element?.closest<HTMLElement>('tr[data-row-key]')
  return row?.dataset.rowKey || null
}

function moveWithKeyboard(record: ServiceConfig, event: unknown) {
  const keyboardEvent = event as ServiceKeyboardEvent
  if (keyboardEvent.key !== 'ArrowUp' && keyboardEvent.key !== 'ArrowDown') return
  keyboardEvent.preventDefault()
  store.moveService(record.id, keyboardEvent.key === 'ArrowUp' ? -1 : 1)
}

function setEnabled(record: ServiceConfig, checked: boolean) {
  record.enabled = checked
  store.setMessage('info', `${record.name} 已${checked ? '启用' : '停用'}，保存后生效`)
}

function handleRowAction(action: string, record: ServiceConfig) {
  if (action === 'delete') {
    modal.confirm({
      title: '删除服务？',
      content: `确定删除「${record.name}」？保存服务配置后生效。`,
      icon: h(ExclamationCircleOutlined),
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => store.removeService(record.id),
    })
  }
}

function rowClassName(record: ServiceConfig) {
  return [
    'service-row',
    draggingServiceId.value === record.id ? 'service-row-dragging' : '',
    dragOverServiceId.value === record.id ? 'service-row-drop-target' : '',
  ].filter(Boolean).join(' ')
}

function dropPlacement(targetId: string, clientY: number) {
  const row = Array.from(globalThis.document.querySelectorAll<HTMLElement>('tr[data-row-key]'))
    .find((element) => element.dataset.rowKey === targetId)
  if (!row) return 'before'
  const rect = row.getBoundingClientRect()
  return clientY > rect.top + rect.height / 2 ? 'after' : 'before'
}
</script>

<template>
  <div class="grid gap-4">
    <section v-for="group in visibleGroups" :key="group.key" class="overflow-hidden rounded-lg border border-[var(--line-soft)]">
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
        :row-class-name="rowClassName"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'enabled'">
            <a-switch
              size="small"
              :checked="(record as ServiceConfig).enabled"
              :aria-label="`${(record as ServiceConfig).name}启用状态`"
              @change="(checked) => setEnabled(record as ServiceConfig, Boolean(checked))"
            />
          </template>
          <template v-else-if="column.key === 'name'">
            <div class="flex min-w-0 items-center gap-2">
              <a-tooltip title="拖动排序">
                <span
                  class="service-drag-handle"
                  role="button"
                  tabindex="0"
                  :aria-label="`拖动 ${(record as ServiceConfig).name} 排序`"
                  @pointerdown="beginPointerDrag(record as ServiceConfig, $event)"
                  @pointermove="updatePointerDrag"
                  @pointerup="endPointerDrag"
                  @pointercancel="cancelPointerDrag"
                  @keydown="moveWithKeyboard(record as ServiceConfig, $event)"
                >
                  <HolderOutlined />
                </span>
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
              <a-dropdown trigger="click">
                <a-tooltip title="更多操作">
                  <a-button type="text" aria-label="更多操作">
                    <template #icon><MoreOutlined /></template>
                  </a-button>
                </a-tooltip>
                <template #overlay>
                  <a-menu @click="(event) => handleRowAction(String(event.key), record as ServiceConfig)">
                    <a-menu-item key="delete" danger>
                      <template #icon><DeleteOutlined /></template>
                      删除
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </a-space>
          </template>
        </template>
      </a-table>
    </section>
  </div>
</template>

<style scoped>
.service-drag-handle {
  display: inline-flex;
  width: 24px;
  height: 28px;
  flex: 0 0 auto;
  color: var(--text-muted);
  cursor: grab;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  font-size: 15px;
  touch-action: none;
  user-select: none;
}

.service-drag-handle:hover,
.service-drag-handle:focus-visible {
  color: #2563eb;
  background: rgba(37, 99, 235, 0.08);
  outline: none;
}

.service-drag-handle:active {
  cursor: grabbing;
}

:deep(.service-row) {
  cursor: default;
}

:deep(.service-row-dragging) {
  opacity: 0.45;
}

:deep(.service-row-drop-target td) {
  background: rgba(22, 119, 255, 0.08) !important;
}
</style>
