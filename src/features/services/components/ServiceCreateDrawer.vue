<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { defaultServiceDraft } from '@/shared/domain/defaults'
import { loopbackIpRule, portRule, requiredRule } from '@/shared/domain/validators'
import { useAppStore } from '@/stores/appStore'
import type { ServiceConfig } from '@/shared/types'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const store = useAppStore()
const formRef = ref()
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
  await formRef.value?.validate()
  if (store.addService({ ...form })) {
    drawerOpen.value = false
  }
}
</script>

<template>
  <a-drawer v-model:open="drawerOpen" title="添加服务" width="460">
    <a-form ref="formRef" :model="form" layout="vertical">
      <a-form-item label="服务名" name="name" :rules="[requiredRule('请填写服务名')]">
        <a-input v-model:value="form.name" />
      </a-form-item>
      <a-form-item label="域名" name="domain" :rules="[requiredRule('请填写真实域名')]">
        <a-input v-model:value="form.domain" />
      </a-form-item>
      <a-form-item label="端口" name="port" :rules="[portRule()]">
        <a-input-number v-model:value="form.port" class="w-full" :min="1" :max="65535" />
      </a-form-item>
      <a-form-item label="本地 IP" name="localIp" :rules="[loopbackIpRule()]">
        <a-input v-model:value="form.localIp" />
      </a-form-item>
      <a-form-item label="隧道" name="tunnelId">
        <a-select v-model:value="form.tunnelId">
          <a-select-option v-for="tunnel in store.settings.tunnels" :key="tunnel.id" :value="tunnel.id">
            {{ tunnel.name }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item label="启用" name="enabled">
        <a-switch v-model:checked="form.enabled" />
      </a-form-item>
    </a-form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <a-button @click="drawerOpen = false">取消</a-button>
        <a-button type="primary" @click="submit">添加</a-button>
      </div>
    </template>
  </a-drawer>
</template>
