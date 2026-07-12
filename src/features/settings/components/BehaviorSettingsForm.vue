<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ThemeSelector from './ThemeSelector.vue'
import { useAppStore } from '@/stores/appStore'
import { useUpdateStore } from '@/stores/updateStore'
import type { CloseAction } from '@/shared/types'

const store = useAppStore()
const updateStore = useUpdateStore()
let launchStateTimer: ReturnType<typeof window.setTimeout> | undefined
let savedStateTimer: ReturnType<typeof window.setTimeout> | undefined
const savedState = ref('')

const closeActionOptions: { label: string; value: CloseAction }[] = [
  { label: '每次询问', value: 'ask' },
  { label: '最小化到托盘', value: 'minimizeToTray' },
  { label: '退出应用', value: 'exit' },
]

async function saveBehavior() {
  await store.saveSettingsOnly('')
  savedState.value = store.messageType === 'error' ? '保存失败' : '已自动保存'
  if (savedStateTimer) window.clearTimeout(savedStateTimer)
  savedStateTimer = window.setTimeout(() => {
    savedState.value = ''
  }, 1800)
}

function changeCloseAction(value: CloseAction) {
  if (store.settings.behavior.closeAction === value) return
  store.settings.behavior.closeAction = value
  saveBehavior()
}

function handleCloseAction(value: string | number) {
  changeCloseAction(String(value) as CloseAction)
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
onBeforeUnmount(() => {
  cancelLaunchStateRefresh()
  if (savedStateTimer) window.clearTimeout(savedStateTimer)
})
</script>

<template>
  <div class="settings-form grid gap-4">
    <div class="flex h-5 justify-end text-xs text-[var(--text-muted)]" aria-live="polite">{{ savedState }}</div>
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
          <div><div class="settings-row-title">启动后最小化</div><div class="settings-row-description">打开应用后隐藏主窗口，仅保留托盘入口。</div></div>
          <a-switch v-model:checked="store.settings.behavior.startMinimized" aria-label="启动后最小化" @change="saveBehavior" />
        </div>
        <div class="settings-row">
          <div><div class="settings-row-title">打开软件后自动启动</div><div class="settings-row-description">配置检查通过后自动启动当前 Profile。</div></div>
          <a-switch v-model:checked="store.settings.behavior.autoStartProfile" aria-label="打开软件后自动启动" @change="saveBehavior" />
        </div>
        <div class="settings-row">
          <div><div class="settings-row-title">开机启动</div><div class="settings-row-description">登录系统后自动运行 TunnelDesk。</div></div>
          <a-switch
            v-model:checked="store.settings.behavior.launchAtLogin"
            :loading="store.loading"
            aria-label="开机启动"
            @change="store.updateLaunchAtLogin"
          />
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
          <div><div class="settings-row-title">点击关闭按钮时</div><div class="settings-row-description">选择关闭主窗口时应用的行为。</div></div>
          <a-segmented
            :value="store.settings.behavior.closeAction"
            :options="closeActionOptions"
            aria-label="关闭行为"
            @change="handleCloseAction"
          />
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
          <div><div class="settings-row-title">启动时自动修复 hosts</div><div class="settings-row-description">启动 Profile 前修复 TunnelDesk 管理的 hosts 记录。</div></div>
          <a-switch v-model:checked="store.settings.behavior.autoRepairOnStart" aria-label="启动时自动修复 hosts" @change="saveBehavior" />
        </div>
        <div class="settings-row">
          <div><div class="settings-row-title">退出时清理 hosts</div><div class="settings-row-description">完全退出应用时移除由 TunnelDesk 写入的记录。</div></div>
          <a-switch v-model:checked="store.settings.behavior.cleanupOnExit" aria-label="退出时清理 hosts" @change="saveBehavior" />
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
            <a-button
              v-if="updateStore.hasAvailableUpdate"
              type="primary"
              :disabled="updateStore.checking || updateStore.installing"
              @click="updateStore.installAvailableUpdate"
            >
              {{ updateStore.installButtonText }}
            </a-button>
            <a-button
              :disabled="updateStore.installing || updateStore.checking"
              @click="updateStore.checkForUpdates()"
            >
              {{ updateStore.checking ? '检查中' : '检查更新' }}
            </a-button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
