<script setup lang="ts">
import { ref } from 'vue'
import { domainRule, loopbackIpRule, portRule, requiredRule } from '@/shared/domain/validators'
import type { ServiceConfig, TunnelConfig } from '@/shared/types'

withDefaults(defineProps<{
  model: ServiceConfig
  serviceGroupOptions: { value: string }[]
  tunnels: TunnelConfig[]
  readonly?: boolean
}>(), {
  readonly: false,
})

const formRef = ref()

function validate() {
  return formRef.value?.validate()
}

defineExpose({
  validate,
})
</script>

<template>
  <a-form ref="formRef" :model="model" layout="vertical">
    <a-form-item label="服务名" name="name" :rules="[requiredRule('请填写服务名')]">
      <a-input v-model:value="model.name" :disabled="readonly" />
    </a-form-item>
    <a-form-item label="分组" name="group">
      <a-auto-complete v-model:value="model.group" class="w-full" :options="serviceGroupOptions" placeholder="未分组" :disabled="readonly" />
    </a-form-item>
    <a-form-item label="域名" name="domain" :rules="[domainRule()]">
      <a-input v-model:value="model.domain" :disabled="readonly" />
    </a-form-item>
    <a-form-item label="备注" name="remark">
      <a-textarea v-model:value="model.remark" :auto-size="{ minRows: 3, maxRows: 6 }" :disabled="readonly" />
    </a-form-item>
    <a-form-item label="端口" name="port" :rules="[portRule()]">
      <a-input-number v-model:value="model.port" class="w-full" :min="1" :max="65535" :disabled="readonly" />
    </a-form-item>
    <a-form-item label="本地 IP" name="localIp" :rules="[loopbackIpRule()]">
      <a-input v-model:value="model.localIp" :disabled="readonly" />
    </a-form-item>
    <a-form-item label="隧道" name="tunnelId">
      <a-select v-model:value="model.tunnelId" :disabled="readonly">
        <a-select-option v-for="tunnel in tunnels" :key="tunnel.id" :value="tunnel.id">
          {{ tunnel.name }}
        </a-select-option>
      </a-select>
    </a-form-item>
    <a-form-item label="启用" name="enabled">
      <a-switch v-model:checked="model.enabled" :disabled="readonly" />
    </a-form-item>
  </a-form>
</template>
