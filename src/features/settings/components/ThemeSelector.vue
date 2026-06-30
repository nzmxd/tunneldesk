<script setup lang="ts">
import { BulbOutlined, DesktopOutlined } from '@ant-design/icons-vue'
import type { Component } from 'vue'
import { useAppStore } from '@/stores/appStore'
import type { ThemeMode } from '@/shared/types'

const store = useAppStore()

const options: { label: string; value: ThemeMode; icon: Component }[] = [
  { label: '系统', value: 'system', icon: DesktopOutlined },
  { label: '浅色', value: 'light', icon: BulbOutlined },
  { label: '深色', value: 'dark', icon: BulbOutlined },
]

function changeTheme(value: ThemeMode) {
  if (store.settings.behavior.themeMode === value) return
  store.settings.behavior.themeMode = value
  void store.saveSettingsOnly('主题已保存')
}
</script>

<template>
  <div class="settings-segmented" role="radiogroup" aria-label="主题">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      class="settings-segmented-option"
      :class="store.settings.behavior.themeMode === option.value ? 'settings-segmented-option-active' : ''"
      :aria-pressed="store.settings.behavior.themeMode === option.value"
      @click="changeTheme(option.value)"
    >
      <component :is="option.icon" class="settings-segmented-icon" />
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>
