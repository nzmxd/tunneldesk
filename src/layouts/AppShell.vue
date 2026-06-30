<script setup lang="ts">
import { ref } from 'vue'
import AppTitleBar from './AppTitleBar.vue'
import SidebarNav from './SidebarNav.vue'
import TopBar from './TopBar.vue'

const collapsed = ref(false)
</script>

<template>
  <div class="grid h-full grid-rows-[34px_minmax(0,1fr)] overflow-hidden bg-[var(--app-bg)] text-[var(--text-primary)]">
    <AppTitleBar />
    <a-layout class="min-h-0 min-w-0 bg-transparent">
      <a-layout-sider
        v-model:collapsed="collapsed"
        breakpoint="lg"
        collapsible
        theme="light"
        width="252"
        :collapsed-width="68"
        class="app-sider"
      >
        <SidebarNav :collapsed="collapsed" />
      </a-layout-sider>
      <a-layout class="min-w-0 bg-transparent">
        <TopBar />
        <a-layout-content class="min-h-0 overflow-hidden">
          <div class="app-scrollbar h-full overflow-auto px-4 py-4 md:px-6 md:py-5">
            <RouterView />
          </div>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </div>
</template>
