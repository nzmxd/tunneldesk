<script setup lang="ts">
import PageHeader from '@/shared/ui/PageHeader.vue'
import MetricsGrid from './components/MetricsGrid.vue'
import ServiceStatusTable from './components/ServiceStatusTable.vue'
</script>

<template>
  <PageHeader title="总览" />
  <div class="grid gap-4">
    <MetricsGrid />
    <ServiceStatusTable />
  </div>
</template>
