<script setup lang="ts">
import { FolderOpenOutlined } from '@ant-design/icons-vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import { runningLabel } from '@/shared/domain/serviceStatus'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
</script>

<template>
  <PageHeader title="日志">
    <template #actions>
      <a-button type="primary" :loading="store.loading" @click="store.openLogDir">
        <template #icon><FolderOpenOutlined /></template>
        打开日志目录
      </a-button>
    </template>
  </PageHeader>

  <a-card :bordered="false" class="surface-card">
    <template #title>
      <div class="card-title">
        <span class="card-title-main">运行摘要</span>
      </div>
    </template>
    <a-descriptions bordered size="small" :column="1">
      <a-descriptions-item label="运行状态">{{ runningLabel(store.status.running) }}</a-descriptions-item>
      <a-descriptions-item label="最近消息">{{ store.status.message || '无' }}</a-descriptions-item>
      <a-descriptions-item label="服务数量">{{ store.currentProfile.services.length }}</a-descriptions-item>
    </a-descriptions>
  </a-card>
</template>
