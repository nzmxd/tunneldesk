<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  AppstoreOutlined,
  ApiOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue'
import { useAppStore } from '@/stores/appStore'
import type { RouteKey } from '@/app/router/routes'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const pendingKey = ref<RouteKey | null>(null)
let navigationFrame: number | undefined
let navigationTimer: ReturnType<typeof window.setTimeout> | undefined

defineProps<{
  collapsed: boolean
}>()

const navItems: { key: RouteKey; icon: Component; label: string }[] = [
  { key: 'overview', icon: AppstoreOutlined, label: '总览' },
  { key: 'tunnels', icon: ApiOutlined, label: '隧道' },
  { key: 'services', icon: DatabaseOutlined, label: '服务' },
  { key: 'diagnostics', icon: SafetyCertificateOutlined, label: '诊断' },
  { key: 'logs', icon: FileTextOutlined, label: '日志' },
  { key: 'settings', icon: SettingOutlined, label: '设置' },
]

const currentKey = computed<RouteKey>(() => {
  const routeName = String(route.name || 'overview')
  return navItems.some((item) => item.key === routeName) ? (routeName as RouteKey) : 'overview'
})

const selectedKey = computed(() => pendingKey.value || currentKey.value)

function clearScheduledNavigation() {
  if (navigationFrame !== undefined) {
    window.cancelAnimationFrame(navigationFrame)
    navigationFrame = undefined
  }
  if (navigationTimer !== undefined) {
    window.clearTimeout(navigationTimer)
    navigationTimer = undefined
  }
}

function go(key: RouteKey) {
  if (selectedKey.value === key) return
  pendingKey.value = key
  clearScheduledNavigation()
  navigationFrame = window.requestAnimationFrame(() => {
    navigationFrame = undefined
    navigationTimer = window.setTimeout(() => {
      navigationTimer = undefined
      void router
        .push({ name: key })
        .catch(() => {})
        .finally(() => {
          pendingKey.value = null
        })
    }, 0)
  })
}

onBeforeUnmount(() => {
  clearScheduledNavigation()
})
</script>

<template>
  <div class="flex h-full flex-col bg-[var(--sidebar-bg)]">
    <div
      class="flex h-[66px] items-center border-b border-[var(--line-soft)]"
      :class="collapsed ? 'justify-center px-0' : 'gap-3 px-4'"
    >
      <div class="brand-mark">
        <ApiOutlined />
      </div>
      <div v-if="!collapsed" class="min-w-0">
        <div class="truncate text-[15px] font-semibold leading-5 text-[var(--text-primary)]">TunnelDesk</div>
        <div class="truncate text-xs text-[var(--text-muted)]">Local routing workspace</div>
      </div>
    </div>

    <nav class="flex-1 space-y-1 px-2 py-3">
      <button
        v-for="item in navItems"
        :key="item.key"
        type="button"
        class="sidebar-nav-item"
        :class="[
          selectedKey === item.key ? 'sidebar-nav-item-active' : '',
          collapsed ? 'justify-center px-0' : 'px-3',
        ]"
        @click="go(item.key)"
      >
        <component :is="item.icon" class="sidebar-nav-icon" />
        <span v-if="!collapsed" class="truncate">{{ item.label }}</span>
      </button>
    </nav>

    <div v-if="!collapsed" class="mx-3 mb-3 rounded-md border border-[var(--line-soft)] bg-[var(--panel-subtle)] p-3">
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs font-medium text-[var(--text-secondary)]">Profile</span>
        <span class="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span
            class="h-1.5 w-1.5 rounded-full"
            :class="store.status.running ? 'bg-emerald-500' : 'bg-amber-500'"
          />
          {{ store.status.running ? '运行中' : '已停止' }}
        </span>
      </div>
      <div class="mt-2 truncate text-sm font-medium text-[var(--text-primary)]">{{ store.currentProfile.name }}</div>
      <div class="mt-1 text-xs text-[var(--text-muted)]">
        {{ store.activeServices.length }} 服务 / {{ store.profileTunnelIds.length }} 隧道
      </div>
    </div>
  </div>
</template>
