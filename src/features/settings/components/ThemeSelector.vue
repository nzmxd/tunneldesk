<script setup lang="ts">
import { BulbOutlined, DesktopOutlined } from '@ant-design/icons-vue'
import { h } from 'vue'
import { useAppStore } from '@/stores/appStore'
import type { ThemeMode } from '@/shared/types'

const store = useAppStore()

const options = [
  { label: '系统', value: 'system', icon: h(DesktopOutlined) },
  { label: '浅色', value: 'light', icon: h(BulbOutlined) },
  { label: '深色', value: 'dark', icon: h(BulbOutlined) },
]

async function changeTheme(value: string | number) {
  store.settings.behavior.themeMode = value as ThemeMode
  await store.saveSettingsOnly('主题已保存')
}
</script>

<template>
  <a-segmented :value="store.settings.behavior.themeMode" :options="options" @change="changeTheme" />
</template>
