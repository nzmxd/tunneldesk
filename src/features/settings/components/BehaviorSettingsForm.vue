<script setup lang="ts">
import ThemeSelector from './ThemeSelector.vue'
import { useAppStore } from '@/stores/appStore'
import { useUpdateStore } from '@/stores/updateStore'

const store = useAppStore()
const updateStore = useUpdateStore()

function saveBehavior() {
  void store.saveSettingsOnly('应用设置已保存')
}
</script>

<template>
  <div class="settings-form grid gap-4">
    <a-card title="主题" :bordered="false">
      <ThemeSelector />
    </a-card>

    <a-card title="启动行为" :bordered="false">
      <a-list item-layout="horizontal">
        <a-list-item>
          <a-list-item-meta class="min-w-0" title="启动后最小化" />
          <a-switch v-model:checked="store.settings.behavior.startMinimized" @change="saveBehavior" />
        </a-list-item>
        <a-list-item>
          <a-list-item-meta class="min-w-0" title="打开软件后自动启动" />
          <a-switch v-model:checked="store.settings.behavior.autoStartProfile" @change="saveBehavior" />
        </a-list-item>
        <a-list-item>
          <a-list-item-meta class="min-w-0" title="开机启动" />
          <a-switch v-model:checked="store.settings.behavior.launchAtLogin" @change="store.updateLaunchAtLogin" />
        </a-list-item>
      </a-list>
    </a-card>

    <a-card title="hosts 行为" :bordered="false">
      <a-list item-layout="horizontal">
        <a-list-item>
          <a-list-item-meta class="min-w-0" title="启动时自动修复 hosts" />
          <a-switch v-model:checked="store.settings.behavior.autoRepairOnStart" @change="saveBehavior" />
        </a-list-item>
        <a-list-item>
          <a-list-item-meta class="min-w-0" title="退出时清理 hosts" />
          <a-switch v-model:checked="store.settings.behavior.cleanupOnExit" @change="saveBehavior" />
        </a-list-item>
      </a-list>
    </a-card>

    <a-card title="软件更新" :bordered="false">
      <a-list item-layout="horizontal">
        <a-list-item>
          <a-list-item-meta class="min-w-0" :title="updateStore.updateSummary" />
          <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <a-button
              v-if="updateStore.hasAvailableUpdate"
              type="primary"
              :loading="updateStore.installing"
              :disabled="updateStore.checking"
              @click="updateStore.installAvailableUpdate"
            >
              {{ updateStore.installButtonText }}
            </a-button>
            <a-button
              :loading="updateStore.checking"
              :disabled="updateStore.installing"
              @click="updateStore.checkForUpdates()"
            >
              检查更新
            </a-button>
          </div>
        </a-list-item>
      </a-list>
    </a-card>
  </div>
</template>
