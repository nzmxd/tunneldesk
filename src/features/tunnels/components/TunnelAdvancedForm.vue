<script setup lang="ts">
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
</script>

<template>
  <a-card title="高级参数" :bordered="false">
    <a-form :model="store.currentTunnel" layout="vertical">
      <a-form-item label="ServerAliveInterval">
        <a-input-number v-model:value="store.currentTunnel.ssh.serverAliveInterval" class="w-full" :min="5" />
      </a-form-item>
      <a-form-item label="ServerAliveCountMax">
        <a-input-number v-model:value="store.currentTunnel.ssh.serverAliveCountMax" class="w-full" :min="1" />
      </a-form-item>
    </a-form>
  </a-card>
</template>
