<script setup lang="ts">
import PageHeader from '@/shared/ui/PageHeader.vue'
import DiagnosticsPanel from './components/DiagnosticsPanel.vue'
import TunnelStatusList from './components/TunnelStatusList.vue'
</script>

<template>
  <PageHeader title="诊断" />
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
    <DiagnosticsPanel />
    <TunnelStatusList />
  </div>
</template>
