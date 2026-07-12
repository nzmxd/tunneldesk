<script setup lang="ts">
import { ref } from 'vue'
import AppTitleBar from './AppTitleBar.vue'
import SidebarNav from './SidebarNav.vue'

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
        width="232"
        :collapsed-width="64"
        class="app-sider"
      >
        <SidebarNav :collapsed="collapsed" />
      </a-layout-sider>
      <a-layout-content class="min-h-0 min-w-0 overflow-hidden bg-transparent">
        <div class="app-scrollbar h-full overflow-auto px-4 py-5 md:px-6 md:py-6 xl:px-7">
          <RouterView />
        </div>
      </a-layout-content>
    </a-layout>
  </div>
</template>
