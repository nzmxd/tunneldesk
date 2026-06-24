<script setup lang="ts">
import { BorderOutlined, CloseOutlined, MinusOutlined } from '@ant-design/icons-vue'
import { getCurrentWindow } from '@tauri-apps/api/window'

const appWindow = getCurrentWindow()

function minimize() {
  void appWindow.hide()
}

function toggleMaximize() {
  void appWindow.toggleMaximize()
}

function closeWindow() {
  void appWindow.close()
}
</script>

<template>
  <div
    data-tauri-drag-region
    class="app-titlebar grid h-9 select-none grid-cols-[1fr_auto] border-b border-slate-200 bg-white text-slate-950 dark:border-slate-800 dark:bg-[#101418] dark:text-slate-100"
    @dblclick="toggleMaximize"
  >
    <div data-tauri-drag-region class="flex min-w-0 items-center gap-2 px-3">
      <div class="flex h-5 w-5 items-center justify-center rounded bg-emerald-700 text-[13px] font-bold text-white">T</div>
      <span class="truncate text-sm font-medium">TunnelDesk</span>
    </div>
    <div class="flex h-full items-stretch">
      <button class="titlebar-button" type="button" aria-label="最小化" @click.stop="minimize" @dblclick.stop>
        <MinusOutlined />
      </button>
      <button class="titlebar-button" type="button" aria-label="最大化" @click.stop="toggleMaximize" @dblclick.stop>
        <BorderOutlined />
      </button>
      <button class="titlebar-button close" type="button" aria-label="关闭" @click.stop="closeWindow" @dblclick.stop>
        <CloseOutlined />
      </button>
    </div>
  </div>
</template>
