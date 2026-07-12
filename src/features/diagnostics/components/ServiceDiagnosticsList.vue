<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircleOutlined, CloseCircleOutlined, PauseCircleOutlined } from '@ant-design/icons-vue'
import { serviceStateText } from '@/shared/domain/serviceStatus'
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
const serviceRows = computed(() =>
  store.orderedCurrentServices.map((service) => ({
    service,
    status: store.status.services.find((item) => item.serviceId === service.id),
  })),
)
</script>

<template>
  <a-card :bordered="false" class="surface-card">
    <template #title>
      <div class="card-title">
        <span class="card-title-main">服务健康</span>
        <span class="card-title-meta">{{ serviceRows.length }}</span>
      </div>
    </template>
    <a-empty v-if="!serviceRows.length" description="当前 Profile 暂无服务" />
    <a-list v-else :data-source="serviceRows">
      <template #renderItem="{ item }">
        <a-list-item class="interactive-row">
          <a-list-item-meta
            :title="item.service.name"
            :description="item.status?.message || `${item.service.localIp}:${item.service.port}`"
          />
          <a-tag :color="item.status?.state === 'healthy' ? 'success' : item.status?.state === 'error' ? 'error' : 'default'">
            <template #icon>
              <CheckCircleOutlined v-if="item.status?.state === 'healthy'" />
              <CloseCircleOutlined v-else-if="item.status?.state === 'error'" />
              <PauseCircleOutlined v-else />
            </template>
            {{ serviceStateText(item.status?.state) }}
          </a-tag>
        </a-list-item>
      </template>
    </a-list>
  </a-card>
</template>
