<script setup lang="ts">
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
</script>

<template>
  <a-modal
    v-model:open="store.unsavedProfilesConfirmOpen"
    title="丢弃未保存的服务配置？"
    ok-text="丢弃并继续"
    cancel-text="取消"
    :ok-button-props="{ danger: true }"
    :confirm-loading="store.loading"
    @ok="store.confirmUnsavedProfilesAction"
    @cancel="store.cancelUnsavedProfilesAction"
  >
    <p class="m-0 text-sm leading-6 text-[var(--text-secondary)]">
      当前 Profile 有未保存的服务配置。继续操作会重新加载或切换配置，这些更改将丢失。
    </p>
  </a-modal>
</template>
