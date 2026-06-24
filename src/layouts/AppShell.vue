<script setup lang="ts">
import { ref } from 'vue'
import AppTitleBar from './AppTitleBar.vue'
import SidebarNav from './SidebarNav.vue'
import TopBar from './TopBar.vue'

const collapsed = ref(false)
</script>

<template>
  <div class="grid h-full grid-rows-[36px_minmax(0,1fr)] overflow-hidden bg-slate-100 dark:bg-[#101418]">
    <AppTitleBar />
    <a-layout class="min-h-0 min-w-0">
      <a-layout-sider
        v-model:collapsed="collapsed"
        breakpoint="lg"
        collapsible
        theme="light"
        width="236"
        :collapsed-width="72"
        class="app-sider border-r border-slate-200 dark:border-slate-800"
      >
        <SidebarNav :collapsed="collapsed" />
      </a-layout-sider>
      <a-layout class="min-w-0">
        <TopBar />
        <a-layout-content class="min-h-0 overflow-hidden">
          <div class="app-scrollbar h-full overflow-auto px-5 py-5 md:px-7">
            <RouterView />
          </div>
        </a-layout-content>
      </a-layout>
    </a-layout>
  </div>
</template>
