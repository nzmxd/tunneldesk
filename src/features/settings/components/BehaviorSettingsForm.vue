<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import ThemeSelector from './ThemeSelector.vue'
import { useAppStore } from '@/stores/appStore'
import { useUpdateStore } from '@/stores/updateStore'

const store = useAppStore()
const updateStore = useUpdateStore()
let launchStateTimer: ReturnType<typeof window.setTimeout> | undefined

function saveBehavior() {
  void store.saveSettingsOnly('应用设置已保存')
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
