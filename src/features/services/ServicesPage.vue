<script setup lang="ts">
import { ref } from 'vue'
import { ExportOutlined, ImportOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons-vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { useAppStore } from '@/stores/appStore'
import type { ProfilesImportSession, TunnelMapping } from '@/shared/types'
import ProfileImportPreviewModal from './components/ProfileImportPreviewModal.vue'
import ServiceCreateDrawer from './components/ServiceCreateDrawer.vue'
import ServicesTable from './components/ServicesTable.vue'

const store = useAppStore()
const createOpen = ref(false)
const importOpen = ref(false)
const importSession = ref<ProfilesImportSession | null>(null)

function changeProfile(profileId: string) {
  void store.selectProfile(profileId)
}

async function openImportPreview() {
  const session = await store.previewProfilesImport()
  if (!session) return
  importSession.value = session
  importOpen.value = true
}

async function updateImportMappings(tunnelMappings: TunnelMapping[]) {
  if (!importSession.value) return
  const session = await store.previewProfilesImport(importSession.value.path, tunnelMappings, true)
  if (session) {
    importSession.value = session
  }
}

async function applyProfilesImport() {
  if (!importSession.value) return
  const result = await store.applyProfilesImport(importSession.value.path, importSession.value.tunnelMappings)
  if (!result) return
  importOpen.value = false
  importSession.value = null
}
</script>

<template>
  <PageHeader title="服务">
    <template #actions>
      <a-select
        :value="store.settings.currentProfileId"
        class="w-[220px]"
        :disabled="store.status.running || store.loading"
        @change="(value) => changeProfile(String(value))"
      >
        <a-select-option v-for="profile in store.profiles.profiles" :key="profile.id" :value="profile.id">
          {{ profile.name }}
        </a-select-option>
      </a-select>
      <a-button :disabled="store.status.running" :loading="store.loading" @click="openImportPreview">
        <template #icon><ImportOutlined /></template>
        导入
      </a-button>
      <a-button :loading="store.loading" @click="store.exportCurrentProfile">
        <template #icon><ExportOutlined /></template>
        导出当前
      </a-button>
      <a-button :loading="store.loading" @click="store.exportAllProfiles">
        <template #icon><ExportOutlined /></template>
        导出全部
      </a-button>
      <a-button @click="createOpen = true">
        <template #icon><PlusOutlined /></template>
        添加服务
      </a-button>
      <a-button type="primary" :loading="store.loading" @click="store.saveProfiles">
        <template #icon><SaveOutlined /></template>
        保存服务
      </a-button>
    </template>
  </PageHeader>

  <a-card :bordered="false" class="surface-card">
    <template #title>
      <div class="card-title">
        <span class="card-title-main">服务映射</span>
        <span class="card-title-meta">{{ store.currentProfile.services.length }} 个服务</span>
      </div>
    </template>
    <ServicesTable v-if="store.currentProfile.services.length" />
    <EmptyState v-else description="暂无服务配置" />
  </a-card>

  <ServiceCreateDrawer v-model:open="createOpen" />
  <ProfileImportPreviewModal
    v-model:open="importOpen"
    :session="importSession"
    @mapping-change="updateImportMappings"
    @apply="applyProfilesImport"
  />
</template>
