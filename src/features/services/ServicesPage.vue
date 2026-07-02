<script setup lang="ts">
import { ref } from 'vue'
import {
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  ImportOutlined,
  MoreOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import { useAppStore } from '@/stores/appStore'
import type { ProfilesImportSession, TunnelMapping } from '@/shared/types'
import ProfileImportPreviewModal from './components/ProfileImportPreviewModal.vue'
import ServiceCreateDrawer from './components/ServiceCreateDrawer.vue'
import ServicesTable from './components/ServicesTable.vue'

const store = useAppStore()
const createOpen = ref(false)
const profileCreateOpen = ref(false)
const profileName = ref('')
const profileRenameOpen = ref(false)
const profileRenameName = ref('')
const profileDeleteOpen = ref(false)
const importOpen = ref(false)
const importSession = ref<ProfilesImportSession | null>(null)

type ProfileMenuClick = {
  key: string | number
}

function openCreateProfile() {
  profileName.value = `Profile ${store.profiles.profiles.length + 1}`
  profileCreateOpen.value = true
}

async function createProfile() {
  const created = await store.createProfile(profileName.value)
  if (created) {
    profileCreateOpen.value = false
  }
}

function openRenameProfile() {
  profileRenameName.value = store.currentProfile.name
  profileRenameOpen.value = true
}

async function renameProfile() {
  const renamed = await store.renameProfile(store.currentProfile.id, profileRenameName.value)
  if (renamed) {
    profileRenameOpen.value = false
  }
}

async function confirmDeleteProfile() {
  const deleted = await store.deleteProfile(store.currentProfile.id)
  if (deleted) {
    profileDeleteOpen.value = false
  }
}

function handleProfileAction(action: string) {
  if (action === 'create') {
    openCreateProfile()
    return
  }
  if (action === 'rename') {
    openRenameProfile()
    return
  }
  if (action === 'delete') {
    profileDeleteOpen.value = true
    return
  }
  if (action === 'import') {
    void openImportPreview()
    return
  }
  if (action === 'export-current') {
    void store.exportCurrentProfile()
    return
  }
  if (action === 'export-all') {
    void store.exportAllProfiles()
  }
}

function handleProfileMenuClick(event: ProfileMenuClick) {
  handleProfileAction(String(event.key))
}

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
      <div class="flex items-center gap-1">
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
        <a-dropdown trigger="click">
          <a-button class="w-9 px-0" :loading="store.loading" title="Profile 操作" aria-label="Profile 操作">
            <template #icon><MoreOutlined /></template>
          </a-button>
          <template #overlay>
            <a-menu @click="handleProfileMenuClick">
              <a-menu-item key="create" :disabled="store.status.running || store.loading">
                <template #icon><PlusOutlined /></template>
                新建
              </a-menu-item>
              <a-menu-item key="rename" :disabled="store.status.running || store.loading">
                <template #icon><EditOutlined /></template>
                重命名
              </a-menu-item>
              <a-menu-item key="delete" danger :disabled="store.status.running || store.loading || store.profiles.profiles.length <= 1">
                <template #icon><DeleteOutlined /></template>
                删除
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item key="import" :disabled="store.status.running || store.loading">
                <template #icon><ImportOutlined /></template>
                导入
              </a-menu-item>
              <a-menu-item key="export-current" :disabled="store.loading">
                <template #icon><ExportOutlined /></template>
                导出当前
              </a-menu-item>
              <a-menu-item key="export-all" :disabled="store.loading">
                <template #icon><ExportOutlined /></template>
                导出全部
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>
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
  <a-modal
    v-model:open="profileCreateOpen"
    title="新建 Profile"
    ok-text="创建"
    cancel-text="取消"
    :confirm-loading="store.loading"
    @ok="createProfile"
  >
    <a-input v-model:value="profileName" placeholder="Profile 名称" @press-enter="createProfile" />
  </a-modal>
  <a-modal
    v-model:open="profileRenameOpen"
    title="重命名 Profile"
    ok-text="保存"
    cancel-text="取消"
    :confirm-loading="store.loading"
    @ok="renameProfile"
  >
    <a-input v-model:value="profileRenameName" placeholder="Profile 名称" @press-enter="renameProfile" />
  </a-modal>
  <a-modal
    v-model:open="profileDeleteOpen"
    title="删除 Profile"
    ok-text="删除"
    cancel-text="取消"
    :ok-button-props="{ danger: true }"
    :confirm-loading="store.loading"
    @ok="confirmDeleteProfile"
  >
    <p class="m-0">
      确定删除当前 Profile「{{ store.currentProfile.name }}」？
    </p>
  </a-modal>
  <ProfileImportPreviewModal
    v-model:open="importOpen"
    :session="importSession"
    @mapping-change="updateImportMappings"
    @apply="applyProfilesImport"
  />
</template>
