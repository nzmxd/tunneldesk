<script setup lang="ts">
import { computed, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { MenuProps } from 'ant-design-vue'
import {
  AppstoreOutlined,
  ApiOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'

const route = useRoute()
const router = useRouter()

defineProps<{
  collapsed: boolean
}>()

const selectedKeys = computed(() => [String(route.name || 'overview')])

const items = computed<MenuProps['items']>(() => [
  { key: 'overview', icon: () => h(AppstoreOutlined), label: '总览' },
  { key: 'tunnels', icon: () => h(ApiOutlined), label: '隧道' },
  { key: 'services', icon: () => h(DatabaseOutlined), label: '服务' },
  { key: 'settings', icon: () => h(SettingOutlined), label: '设置' },
  { key: 'diagnostics', icon: () => h(SafetyCertificateOutlined), label: '诊断' },
  { key: 'logs', icon: () => h(FileTextOutlined), label: '日志' },
])

const onClick: MenuProps['onClick'] = (info) => {
  void router.push({ name: String(info.key) })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div
      class="flex h-16 items-center border-b border-slate-200 dark:border-slate-800"
      :class="collapsed ? 'justify-center px-0' : 'gap-3 px-5'"
    >
      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-white">
        <ApiOutlined />
      </div>
      <div v-if="!collapsed" class="min-w-0">
        <div class="truncate text-base font-semibold text-slate-950 dark:text-slate-100">TunnelDesk</div>
        <div class="truncate text-xs text-slate-500 dark:text-slate-400">Dev tunnel manager</div>
      </div>
    </div>
    <a-menu
      class="flex-1 border-0 pt-3"
      mode="inline"
      :items="items"
      :selected-keys="selectedKeys"
      @click="onClick"
    />
  </div>
</template>
