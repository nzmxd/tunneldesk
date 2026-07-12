<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ApartmentOutlined,
  FileTextOutlined,
  FundOutlined,
  HddOutlined,
  HomeOutlined,
  RightOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons-vue'
import { useAppStore } from '@/stores/appStore'
import type { RouteKey } from '@/app/router/routes'
import AppMark from '@/shared/ui/AppMark.vue'

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
  { key: 'overview', icon: HomeOutlined, label: '总览' },
  { key: 'tunnels', icon: ApartmentOutlined, label: '隧道' },
  { key: 'services', icon: HddOutlined, label: '服务' },
  { key: 'diagnostics', icon: FundOutlined, label: '诊断' },
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
    <div class="flex h-[112px] items-center" :class="collapsed ? 'justify-center' : 'px-6'">
      <AppMark :size="collapsed ? 38 : 66" :framed="false" />
    </div>

    <nav class="flex flex-1 flex-col px-3 py-3">
      <div class="space-y-1">
        <a-tooltip
          v-for="item in navItems.filter((entry) => entry.key !== 'settings')"
          :key="item.key"
          :title="collapsed ? item.label : undefined"
          placement="right"
        >
          <button
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
        </a-tooltip>
      </div>

      <div class="mt-auto space-y-2">
        <a-tooltip :title="collapsed ? '当前 Profile' : undefined" placement="right">
          <button
            type="button"
            class="profile-card w-full rounded-lg border border-[var(--line-soft)] bg-[var(--panel-subtle)] text-left transition"
            :class="collapsed ? 'profile-card-collapsed flex h-11 items-center justify-center' : 'p-3'"
            @click="go('services')"
          >
            <template v-if="collapsed">
              <span class="profile-avatar"><UserOutlined /></span>
            </template>
            <template v-else>
              <span class="profile-avatar"><UserOutlined /></span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-sm font-semibold text-[var(--text-primary)]">{{ store.currentProfile.name }}</div>
                <div class="mt-1 inline-flex items-center gap-1.5 text-xs" :class="store.status.running ? 'text-emerald-600' : 'text-[var(--text-muted)]'">
                  <span class="h-1.5 w-1.5 rounded-full" :class="store.status.running ? 'bg-emerald-500' : 'bg-amber-500'" />
                  {{ store.status.running ? '运行中' : '已停止' }}
                </div>
                <div class="mt-1 text-xs text-[var(--text-muted)]">
                  {{ store.activeServices.length }} 服务 · {{ store.profileTunnelIds.length }} 隧道
                </div>
              </div>
              <RightOutlined class="text-xs text-[var(--text-muted)]" />
            </template>
          </button>
        </a-tooltip>

        <div class="border-t border-[var(--line-soft)] pt-2">
          <a-tooltip :title="collapsed ? '设置' : undefined" placement="right">
            <button
              type="button"
              class="sidebar-nav-item"
              :class="[
                selectedKey === 'settings' ? 'sidebar-nav-item-active' : '',
                collapsed ? 'justify-center px-0' : 'px-3',
              ]"
              @click="go('settings')"
            >
              <SettingOutlined class="sidebar-nav-icon" />
              <span v-if="!collapsed">设置</span>
            </button>
          </a-tooltip>
        </div>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.profile-card:hover {
  border-color: rgba(37, 99, 235, 0.32);
  background: var(--nav-hover-bg);
}

.profile-card {
  display: flex;
  min-height: 84px;
  align-items: center;
  gap: 10px;
}

.profile-card-collapsed {
  min-height: 44px;
  padding: 0;
}

.profile-avatar {
  display: inline-flex;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: #2563eb;
  background: #eaf2ff;
  font-size: 20px;
}
</style>
