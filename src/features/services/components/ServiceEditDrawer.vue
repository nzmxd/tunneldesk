<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ServiceForm from './ServiceForm.vue'
import { defaultServiceDraft } from '@/shared/domain/defaults'
import { useAppStore } from '@/stores/appStore'
import type { ServiceConfig } from '@/shared/types'

const props = defineProps<{
  open: boolean
  serviceId?: string | null
  mode?: 'view' | 'edit'
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useAppStore()
const serviceFormRef = ref()
const form = reactive<ServiceConfig>(defaultServiceDraft())
const drawerTitle = computed(() => props.mode === 'view' ? '查看服务' : '编辑服务')
const readonly = computed(() => props.mode === 'view')

const drawerOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

const currentService = computed(() => {
  if (!props.serviceId) return undefined
  return store.currentProfile.services.find((service) => service.id === props.serviceId)
})

function resetForm() {
  const service = currentService.value
  Object.assign(form, service ? { ...service } : defaultServiceDraft(store.currentTunnel.id, store.nextServiceLocalIp()))
}

watch(
  [() => props.open, () => props.serviceId],
  ([open]) => {
    if (open) resetForm()
  },
)

async function submit() {
  if (!props.serviceId) return
  await serviceFormRef.value?.validate()
  if (store.updateService(props.serviceId, { ...form })) {
    drawerOpen.value = false
  }
}
</script>

<template>
  <a-drawer v-model:open="drawerOpen" :title="drawerTitle" width="460">
    <ServiceForm
      ref="serviceFormRef"
      :model="form"
      :service-group-options="store.serviceGroupOptions"
      :tunnels="store.settings.tunnels"
      :readonly="readonly"
    />
    <template #footer>
      <div class="flex justify-end gap-2">
        <a-button @click="drawerOpen = false">{{ readonly ? '关闭' : '取消' }}</a-button>
        <a-button v-if="!readonly" type="primary" @click="submit">保存</a-button>
      </div>
    </template>
  </a-drawer>
</template>
