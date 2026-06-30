<script setup lang="ts">
import { ref } from 'vue'
import { PlusOutlined, SaveOutlined } from '@ant-design/icons-vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { useAppStore } from '@/stores/appStore'
import ServiceCreateDrawer from './components/ServiceCreateDrawer.vue'
import ServicesTable from './components/ServicesTable.vue'

const store = useAppStore()
const createOpen = ref(false)
</script>

<template>
  <PageHeader title="服务">
    <template #actions>
      <a-button @click="createOpen = true">
        <template #icon><PlusOutlined /></template>
        添加服务
      </a-button>
      <a-button type="primary" :loading="store.loading" @click="store.saveProfiles">
        <template #icon><SaveOutlined /></template>
        保存服务
      </a-button>
    </template>
  </PageHeader>

  <a-card :bordered="false" class="surface-card">
    <template #title>
      <div class="card-title">
        <span class="card-title-main">服务映射</span>
        <span class="card-title-meta">{{ store.currentProfile.services.length }} 个服务</span>
      </div>
    </template>
    <ServicesTable v-if="store.currentProfile.services.length" />
    <EmptyState v-else description="暂无服务配置" />
  </a-card>

  <ServiceCreateDrawer v-model:open="createOpen" />
</template>
