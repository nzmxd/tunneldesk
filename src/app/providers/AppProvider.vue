<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { setTheme } from '@tauri-apps/api/app'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import ToastBridge from './ToastBridge.vue'
import { useAppStore } from '@/stores/appStore'
import { useUpdateStore } from '@/stores/updateStore'
import { useAntdTheme } from '@/app/theme/antdTheme'
import { useThemeMode } from '@/app/theme/useThemeMode'

const store = useAppStore()
const updateStore = useUpdateStore()
const themeMode = computed(() => store.settings.behavior.themeMode)
const { effectiveTheme } = useThemeMode(themeMode)
const themeConfig = useAntdTheme(effectiveTheme)

watch(
  effectiveTheme,
  (value) => {
    document.documentElement.dataset.theme = value
    document.documentElement.classList.toggle('dark', value === 'dark')
    void setTheme(value).catch(() => {})
  },
  { immediate: true },
)

onMounted(() => {
  void store.bootstrap().then(() => updateStore.checkForUpdates({ silent: true }))
})
</script>

<template>
  <a-config-provider :locale="zhCN" :theme="themeConfig" component-size="middle">
    <a-app class="h-full">
      <slot />
      <ToastBridge />
    </a-app>
  </a-config-provider>
</template>
