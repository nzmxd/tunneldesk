<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import ThemeSelector from './ThemeSelector.vue'
import { useAppStore } from '@/stores/appStore'
import { useUpdateStore } from '@/stores/updateStore'
import type { CloseAction } from '@/shared/types'

const store = useAppStore()
const updateStore = useUpdateStore()
let launchStateTimer: ReturnType<typeof window.setTimeout> | undefined

const closeActionOptions: { label: string; value: CloseAction }[] = [
  { label: '每次询问', value: 'ask' },
  { label: '最小化到托盘', value: 'minimizeToTray' },
  { label: '退出应用', value: 'exit' },
]

function saveBehavior() {
  void store.saveSettingsOnly('应用设置已保存')
}

function changeCloseAction(value: CloseAction) {
  if (store.settings.behavior.closeAction === value) return
  store.settings.behavior.closeAction = value
  saveBehavior()
}

function cancelLaunchStateRefresh() {
  if (launchStateTimer) {
    window.clearTimeout(launchStateTimer)
    launchStateTimer = undefined
  }
}

function scheduleLaunchStateRefresh() {
  cancelLaunchStateRefresh()
  launchStateTimer = window.setTimeout(() => {
    void store.refreshLaunchAtLoginState().catch(() => {})
  }, 120)
}

onMounted(scheduleLaunchStateRefresh)
onBeforeUnmount(cancelLaunchStateRefresh)
</script>

<template>
  <div class="settings-form grid gap-4">
    <section class="settings-panel">
      <div class="settings-panel-head">
        <div class="card-title">
          <span class="card-title-main">主题</span>
        </div>
      </div>
      <div class="settings-panel-body">
        <ThemeSelector />
      </div>
    </section>

    <section class="settings-panel">
      <div class="settings-panel-head">
        <div class="card-title">
          <span class="card-title-main">启动行为</span>
        </div>
      </div>
      <div class="settings-panel-body settings-panel-body-flush">
        <div class="settings-row">
          <span class="settings-row-title">启动后最小化</span>
          <label class="settings-switch" aria-label="启动后最小化">
            <input v-model="store.settings.behavior.startMinimized" class="settings-switch-input" type="checkbox" @change="saveBehavior" />
            <span class="settings-switch-track" aria-hidden="true">
              <span class="settings-switch-thumb" />
            </span>
          </label>
        </div>
        <div class="settings-row">
          <span class="settings-row-title">打开软件后自动启动</span>
          <label class="settings-switch" aria-label="打开软件后自动启动">
            <input v-model="store.settings.behavior.autoStartProfile" class="settings-switch-input" type="checkbox" @change="saveBehavior" />
            <span class="settings-switch-track" aria-hidden="true">
              <span class="settings-switch-thumb" />
            </span>
          </label>
        </div>
        <div class="settings-row">
          <span class="settings-row-title">开机启动</span>
          <label class="settings-switch" aria-label="开机启动">
            <input
              v-model="store.settings.behavior.launchAtLogin"
              class="settings-switch-input"
              type="checkbox"
              @change="store.updateLaunchAtLogin"
            />
            <span class="settings-switch-track" aria-hidden="true">
              <span class="settings-switch-thumb" />
            </span>
          </label>
        </div>
      </div>
    </section>

    <section class="settings-panel">
      <div class="settings-panel-head">
        <div class="card-title">
          <span class="card-title-main">关闭行为</span>
        </div>
      </div>
      <div class="settings-panel-body">
        <div class="settings-row settings-row-borderless">
          <span class="settings-row-title">点击关闭按钮时</span>
          <div class="settings-segmented settings-segmented-close" role="radiogroup" aria-label="关闭行为">
            <button
              v-for="option in closeActionOptions"
              :key="option.value"
              type="button"
              class="settings-segmented-option"
              :class="store.settings.behavior.closeAction === option.value ? 'settings-segmented-option-active' : ''"
              :aria-pressed="store.settings.behavior.closeAction === option.value"
              @click="changeCloseAction(option.value)"
            >
              <span>{{ option.label }}</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="settings-panel">
      <div class="settings-panel-head">
        <div class="card-title">
          <span class="card-title-main">hosts 行为</span>
        </div>
      </div>
      <div class="settings-panel-body settings-panel-body-flush">
        <div class="settings-row">
          <span class="settings-row-title">启动时自动修复 hosts</span>
          <label class="settings-switch" aria-label="启动时自动修复 hosts">
            <input v-model="store.settings.behavior.autoRepairOnStart" class="settings-switch-input" type="checkbox" @change="saveBehavior" />
            <span class="settings-switch-track" aria-hidden="true">
              <span class="settings-switch-thumb" />
            </span>
          </label>
        </div>
        <div class="settings-row">
          <span class="settings-row-title">退出时清理 hosts</span>
          <label class="settings-switch" aria-label="退出时清理 hosts">
            <input v-model="store.settings.behavior.cleanupOnExit" class="settings-switch-input" type="checkbox" @change="saveBehavior" />
            <span class="settings-switch-track" aria-hidden="true">
              <span class="settings-switch-thumb" />
            </span>
          </label>
        </div>
      </div>
    </section>

    <section class="settings-panel">
      <div class="settings-panel-head">
        <div class="card-title">
          <span class="card-title-main">软件更新</span>
        </div>
      </div>
      <div class="settings-panel-body">
        <div class="settings-row settings-row-borderless">
          <span class="settings-row-title">{{ updateStore.updateSummary }}</span>
          <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              v-if="updateStore.hasAvailableUpdate"
              type="button"
              class="settings-action-button settings-action-button-primary"
              :disabled="updateStore.checking || updateStore.installing"
              @click="updateStore.installAvailableUpdate"
            >
              {{ updateStore.installButtonText }}
            </button>
            <button
              type="button"
              class="settings-action-button"
              :disabled="updateStore.installing || updateStore.checking"
              @click="updateStore.checkForUpdates()"
            >
              {{ updateStore.checking ? '检查中' : '检查更新' }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
