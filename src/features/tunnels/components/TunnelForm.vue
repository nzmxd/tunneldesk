<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CheckCircleOutlined, SaveOutlined } from '@ant-design/icons-vue'
import PasswordField from './PasswordField.vue'
import { portRule, requiredRule } from '@/shared/domain/validators'
import { useAppStore } from '@/stores/appStore'
import { usePasswordStore } from '@/stores/passwordStore'

const store = useAppStore()
const passwordStore = usePasswordStore()
const formRef = ref()
const passwordInput = ref('')

const hasSavedPassword = computed(() => passwordStore.hasPassword(store.currentTunnel.id))

watch(
  () => store.currentTunnel.id,
  () => {
    passwordInput.value = ''
  },
)

async function save() {
  await formRef.value?.validate()
  await store.saveTunnel(passwordInput.value)
  passwordInput.value = ''
}

async function test() {
  await formRef.value?.validate()
  await store.testTunnel(passwordInput.value)
  passwordInput.value = ''
}
</script>

<template>
  <a-card title="隧道配置" :bordered="false">
    <a-form ref="formRef" :model="store.currentTunnel" layout="vertical">
      <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
        <a-form-item label="名称" name="name" :rules="[requiredRule('请填写隧道名称')]">
          <a-input v-model:value="store.currentTunnel.name" />
        </a-form-item>
        <a-form-item label="ID" name="id">
          <a-input v-model:value="store.currentTunnel.id" disabled />
        </a-form-item>
        <a-form-item label="启用" name="enabled">
          <a-switch v-model:checked="store.currentTunnel.enabled" />
        </a-form-item>
        <a-form-item label="认证方式" :name="['ssh', 'authMethod']">
          <a-select v-model:value="store.currentTunnel.ssh.authMethod">
            <a-select-option value="password">密码</a-select-option>
            <a-select-option value="privateKey">私钥</a-select-option>
            <a-select-option value="agent">ssh-agent</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Host" :name="['ssh', 'host']" :rules="[requiredRule('请填写 SSH Host')]">
          <a-input v-model:value="store.currentTunnel.ssh.host" />
        </a-form-item>
        <a-form-item label="SSH Port" :name="['ssh', 'port']" :rules="[portRule()]">
          <a-input-number v-model:value="store.currentTunnel.ssh.port" class="w-full" :min="1" :max="65535" />
        </a-form-item>
        <a-form-item label="Username" :name="['ssh', 'username']" :rules="[requiredRule('请填写用户名')]">
          <a-input v-model:value="store.currentTunnel.ssh.username" />
        </a-form-item>
        <a-form-item v-if="store.currentTunnel.ssh.authMethod === 'password'" label="SSH 密码">
          <PasswordField
            v-model="passwordInput"
            :has-saved-password="hasSavedPassword"
            :loading="store.loading"
            @clear="store.clearTunnelPassword(store.currentTunnel.id)"
          />
        </a-form-item>
        <a-form-item v-if="store.currentTunnel.ssh.authMethod === 'privateKey'" label="Identity File" :name="['ssh', 'identityFile']">
          <a-input v-model:value="store.currentTunnel.ssh.identityFile" />
        </a-form-item>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <a-button type="primary" :loading="store.loading" @click="save">
          <template #icon><SaveOutlined /></template>
          保存
        </a-button>
        <a-button :loading="store.loading" @click="test">
          <template #icon><CheckCircleOutlined /></template>
          测试
        </a-button>
      </div>
    </a-form>
  </a-card>
</template>
