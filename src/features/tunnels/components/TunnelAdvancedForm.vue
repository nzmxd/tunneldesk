<script setup lang="ts">
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
</script>

<template>
  <a-collapse class="surface-card" ghost>
    <a-collapse-panel key="advanced" header="高级设置">
      <p class="mt-0 text-sm text-[var(--text-muted)]">调整 SSH 保活策略。通常无需修改默认值。</p>
      <a-form :model="store.currentTunnel" layout="vertical">
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <a-form-item label="ServerAliveInterval">
            <a-input-number v-model:value="store.currentTunnel.ssh.serverAliveInterval" class="w-full" :min="5" />
          </a-form-item>
          <a-form-item label="ServerAliveCountMax">
            <a-input-number v-model:value="store.currentTunnel.ssh.serverAliveCountMax" class="w-full" :min="1" />
          </a-form-item>
        </div>
      </a-form>
    </a-collapse-panel>
  </a-collapse>
</template>
