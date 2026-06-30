<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import { useAppStore } from '@/stores/appStore'
import TunnelAdvancedForm from './components/TunnelAdvancedForm.vue'
import TunnelForm from './components/TunnelForm.vue'
import TunnelList from './components/TunnelList.vue'

const store = useAppStore()
let passwordStateTimer: ReturnType<typeof window.setTimeout> | undefined

onMounted(() => {
  passwordStateTimer = window.setTimeout(() => {
    void store.refreshPasswordState()
  }, 120)
})

onBeforeUnmount(() => {
  if (passwordStateTimer) {
    window.clearTimeout(passwordStateTimer)
  }
})
</script>

<template>
  <PageHeader title="隧道" />
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-[316px_minmax(0,1fr)]">
    <TunnelList
      :tunnels="store.settings.tunnels"
      :current-tunnel-id="store.currentTunnel.id"
      :running-tunnel-ids="store.status.runningTunnelIds"
      @select="store.selectTunnel"
      @add="store.addTunnel"
      @remove="store.removeTunnel"
    />
    <div class="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <TunnelForm />
      <TunnelAdvancedForm />
    </div>
  </div>
</template>
