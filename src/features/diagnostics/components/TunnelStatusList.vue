<script setup lang="ts">
import { useAppStore } from '@/stores/appStore'

const store = useAppStore()
</script>

<template>
  <a-card title="隧道状态" :bordered="false">
    <a-empty v-if="!store.status.tunnels.length" description="暂无隧道状态" />
    <a-list v-else :data-source="store.status.tunnels">
      <template #renderItem="{ item }">
        <a-list-item>
          <a-list-item-meta :title="item.name" :description="item.message" />
          <a-tag :color="item.running ? 'success' : 'default'">
            {{ item.running ? '运行' : '停止' }}
          </a-tag>
        </a-list-item>
      </template>
    </a-list>
  </a-card>
</template>
