<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import ServiceForm from './ServiceForm.vue'
import { defaultServiceDraft } from '@/shared/domain/defaults'
import { useAppStore } from '@/stores/appStore'
import type { ServiceConfig } from '@/shared/types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useAppStore()
const serviceFormRef = ref()
const form = reactive<ServiceConfig>(defaultServiceDraft())

const drawerOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value),
})

function resetForm() {
  Object.assign(form, defaultServiceDraft(store.currentTunnel.id, store.nextServiceLocalIp()))
}

watch(
  () => props.open,
  (value) => {
    if (value) resetForm()
  },
)

async function submit() {
  await serviceFormRef.value?.validate()
  if (store.addService({ ...form })) {
    drawerOpen.value = false
  }
}
</script>

<template>
  <a-drawer v-model:open="drawerOpen" title="添加服务" width="460">
    <ServiceForm ref="serviceFormRef" :model="form" :service-group-options="store.serviceGroupOptions" :tunnels="store.settings.tunnels" />
    <template #footer>
      <div class="flex justify-end gap-2">
        <a-button @click="drawerOpen = false">取消</a-button>
        <a-button type="primary" @click="submit">添加</a-button>
      </div>
    </template>
  </a-drawer>
</template>
