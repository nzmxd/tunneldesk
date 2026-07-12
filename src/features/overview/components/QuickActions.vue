<script setup lang="ts">
import { ApiOutlined, ArrowRightOutlined, ImportOutlined, SafetyCertificateOutlined } from '@ant-design/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const actions = [
  { key: 'tunnel', label: '添加隧道', icon: ApiOutlined, route: 'tunnels', query: { action: 'create' } },
  { key: 'import', label: '导入服务配置', icon: ImportOutlined, route: 'services', query: { action: 'import' } },
  { key: 'diagnostics', label: '查看诊断报告', icon: SafetyCertificateOutlined, route: 'diagnostics', query: undefined },
]
</script>

<template>
  <a-card :bordered="false" class="surface-card h-full">
    <template #title>
      <div class="card-title"><span class="card-title-main">快速操作</span></div>
    </template>
    <div class="overflow-hidden rounded-lg border border-[var(--line-soft)]">
      <button
        v-for="action in actions"
        :key="action.key"
        type="button"
        class="interactive-row flex min-h-14 w-full items-center gap-3 border-0 border-b border-[var(--line-soft)] bg-transparent px-4 text-left last:border-b-0"
        @click="router.push({ name: action.route, query: action.query })"
      >
        <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
          <component :is="action.icon" />
        </span>
        <span class="flex-1 font-medium text-[var(--text-primary)]">{{ action.label }}</span>
        <ArrowRightOutlined class="text-[var(--text-muted)]" />
      </button>
    </div>
    <div class="mt-4 rounded-lg bg-[var(--panel-subtle)] px-3 py-2.5 text-xs text-[var(--text-muted)]">
      启动前会自动校验隧道、服务与 hosts 权限。
    </div>
  </a-card>
</template>
