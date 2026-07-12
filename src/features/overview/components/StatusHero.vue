<script setup lang="ts">
import { computed } from 'vue'
import {
  ApiOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  DatabaseOutlined,
  ExclamationCircleFilled,
  GlobalOutlined,
} from '@ant-design/icons-vue'
import { useAppStore } from '@/stores/appStore'
import { buildOverviewSummary } from '../overviewState'

const store = useAppStore()
const summary = computed(() => buildOverviewSummary(store.currentProfile, store.settings, store.status))
const stageIcons = {
  services: DatabaseOutlined,
  tunnels: ApiOutlined,
  hosts: GlobalOutlined,
}
const statusBadge = computed(() => {
  if (summary.value.title === '运行正常') return { label: '已连接', color: 'success' }
  if (summary.value.title === '准备就绪') return { label: '启动就绪', color: 'success' }
  if (summary.value.title === '需要处理') return { label: '需处理', color: 'error' }
  return { label: '待配置', color: 'warning' }
})
</script>

<template>
  <section class="status-hero app-panel">
    <div class="status-summary">
      <div class="status-symbol" :class="`status-symbol-${summary.tone}`">
        <CheckCircleFilled v-if="summary.tone === 'success'" />
        <CloseCircleFilled v-else-if="summary.tone === 'danger'" />
        <ExclamationCircleFilled v-else />
      </div>
      <div class="min-w-0">
        <div class="text-2xl font-semibold text-[var(--text-primary)]">{{ summary.title }}</div>
        <div class="mt-1 text-sm text-[var(--text-muted)]">{{ summary.description }}</div>
        <a-tag class="status-badge mt-3" :color="statusBadge.color">
          <span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
          {{ statusBadge.label }}
        </a-tag>
      </div>
    </div>
    <div class="status-stages">
      <template v-for="(stage, index) in summary.stages" :key="stage.key">
        <div class="status-stage">
          <div class="status-stage-icon" :class="`status-stage-${stage.tone}`">
            <component :is="stageIcons[stage.key]" />
          </div>
          <div class="mt-2 text-sm font-semibold text-[var(--text-primary)]">{{ stage.label }}</div>
          <div class="mt-0.5 text-xs" :class="`stage-text-${stage.tone}`">{{ stage.detail }}</div>
        </div>
        <div v-if="index < summary.stages.length - 1" class="status-connector" :class="`status-connector-${stage.tone}`">
          <CheckCircleFilled
            v-if="stage.tone === 'success' && summary.stages[index + 1]?.tone === 'success'"
            class="status-connector-check"
          />
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.status-hero {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(420px, 1.2fr);
  min-height: 178px;
}

.status-summary {
  display: flex;
  align-items: center;
  gap: 18px;
  border-right: 1px solid var(--line-soft);
  padding: 28px;
}

.status-symbol {
  display: flex;
  width: 68px;
  height: 68px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 34px;
}

.status-symbol-success { color: #16a34a; background: #ecfdf3; }
.status-symbol-warning { color: #d97706; background: #fffbeb; }
.status-symbol-danger { color: #dc2626; background: #fef2f2; }

.status-stages {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.status-stage { min-width: 104px; text-align: center; }
.status-stage-icon {
  display: inline-flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 22px;
}
.status-badge { margin-inline-end: 0; border-radius: 6px; padding: 2px 10px; }
.status-stage-success { color: #15803d; background: #ecfdf3; }
.status-stage-warning { color: #b45309; background: #fffbeb; }
.status-stage-danger { color: #b91c1c; background: #fef2f2; }
.status-stage-neutral { color: #2563eb; background: #eff6ff; }
.stage-text-success { color: var(--success); }
.stage-text-warning { color: var(--warning); }
.stage-text-danger { color: var(--danger); }
.stage-text-neutral { color: var(--text-muted); }
.status-connector {
  position: relative;
  display: flex;
  width: clamp(32px, 5vw, 84px);
  height: 1px;
  align-items: center;
  justify-content: center;
  border-top: 2px dashed var(--line);
}
.status-connector-check {
  border-radius: 50%;
  color: #16a34a;
  background: var(--panel-bg);
  font-size: 17px;
}
.status-connector-success { border-color: rgba(22, 163, 74, 0.45); }
.status-connector-danger { border-color: rgba(220, 38, 38, 0.45); }

:global(:root[data-theme="dark"]) .status-symbol-success,
:global(:root[data-theme="dark"]) .status-stage-success { background: rgba(22, 163, 74, 0.14); }
:global(:root[data-theme="dark"]) .status-symbol-warning,
:global(:root[data-theme="dark"]) .status-stage-warning { background: rgba(217, 119, 6, 0.14); }
:global(:root[data-theme="dark"]) .status-symbol-danger,
:global(:root[data-theme="dark"]) .status-stage-danger { background: rgba(220, 38, 38, 0.14); }
:global(:root[data-theme="dark"]) .status-stage-neutral { background: rgba(37, 99, 235, 0.16); }

@media (max-width: 960px) {
  .status-hero { grid-template-columns: 1fr; }
  .status-summary { border-right: 0; border-bottom: 1px solid var(--line-soft); }
}

@media (max-width: 640px) {
  .status-summary { padding: 20px; }
  .status-stages { overflow-x: auto; justify-content: flex-start; padding: 18px; }
  .status-symbol { width: 54px; height: 54px; font-size: 28px; }
}
</style>
