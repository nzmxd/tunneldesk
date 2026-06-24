<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import {
  Activity,
  Cable,
  CheckCircle2,
  Database,
  FileText,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Square,
  Sun,
  Trash2,
} from '@lucide/vue'
import { api } from './api'
import type {
  AppSettings,
  AppStatus,
  ProfilesFile,
  ServiceConfig,
  ServiceProfile,
  ThemeMode,
  TunnelConfig,
} from './types'

const DEFAULT_TUNNEL_ID = 'default'

const tabs = [
  { id: 'overview', label: '总览', icon: Activity },
  { id: 'tunnels', label: '隧道', icon: KeyRound },
  { id: 'services', label: '服务', icon: Database },
  { id: 'settings', label: '设置', icon: Settings },
  { id: 'diagnostics', label: '诊断', icon: ShieldAlert },
  { id: 'logs', label: '日志', icon: FileText },
] as const

const themeOptions = [
  { id: 'system', label: 'System', icon: Monitor },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
] as const

type TabId = (typeof tabs)[number]['id']

const activeTab = ref<TabId>('overview')
const loading = ref(false)
const message = ref('')
const passwordInput = ref('')
const savedPasswords = ref<Record<string, boolean>>({})
const settingsLoaded = ref(false)
const systemDark = ref(false)

const settings = ref<AppSettings>({
  schemaVersion: 2,
  currentProfileId: 'default',
  currentTunnelId: DEFAULT_TUNNEL_ID,
  tunnels: [defaultTunnel()],
  behavior: {
    startMinimized: false,
    autoStartProfile: false,
    launchAtLogin: false,
    autoRepairOnStart: false,
    cleanupOnExit: true,
    themeMode: 'system',
  },
})

const profiles = ref<ProfilesFile>({
  schemaVersion: 2,
  profiles: [{ id: 'default', name: 'Default Profile', enabled: true, services: [] }],
})

const status = ref<AppStatus>({
  running: false,
  currentProfileId: 'default',
  runningTunnelIds: [],
  tunnels: [],
  isAdmin: false,
  hostsBlockPresent: false,
  message: 'Stopped',
  services: [],
})

const newService = reactive<ServiceConfig>({
  id: '',
  name: '',
  domain: '',
  port: 3306,
  localIp: '127.77.0.10',
  tunnelId: DEFAULT_TUNNEL_ID,
  enabled: true,
})

function defaultSsh() {
  return {
    host: '',
    port: 22,
    username: '',
    authMethod: 'password' as const,
    identityFile: '',
    passwordCredentialKey: '',
    keyPassphraseCredentialKey: '',
    serverAliveInterval: 30,
    serverAliveCountMax: 3,
  }
}

function defaultTunnel(): TunnelConfig {
  return {
    id: DEFAULT_TUNNEL_ID,
    name: 'Default Tunnel',
    enabled: true,
    ssh: defaultSsh(),
  }
}

const currentProfile = computed<ServiceProfile>(() => {
  return (
    profiles.value.profiles.find((profile) => profile.id === settings.value.currentProfileId) ||
    profiles.value.profiles[0]
  )
})

const currentTunnel = computed<TunnelConfig>(() => {
  return (
    settings.value.tunnels.find((tunnel) => tunnel.id === settings.value.currentTunnelId) ||
    settings.value.tunnels[0]
  )
})

const runningLabel = computed(() => (status.value.running ? '运行中' : '已停止'))
const effectiveTheme = computed(() => {
  if (settings.value.behavior.themeMode === 'system') {
    return systemDark.value ? 'dark' : 'light'
  }
  return settings.value.behavior.themeMode
})
const activeServices = computed(() => currentProfile.value.services.filter((service) => service.enabled))
const profileTunnelIds = computed(() => {
  return Array.from(new Set(activeServices.value.map((service) => service.tunnelId))).filter(Boolean)
})
const currentTunnelHasPassword = computed(() => Boolean(savedPasswords.value[currentTunnel.value?.id]))

let mediaQuery: MediaQueryList | null = null
let mediaListener: ((event: MediaQueryListEvent) => void) | null = null

function tunnelName(tunnelId: string) {
  return settings.value.tunnels.find((tunnel) => tunnel.id === tunnelId)?.name || tunnelId
}

function tunnelRunning(tunnelId: string) {
  return status.value.runningTunnelIds.includes(tunnelId)
}

function applyTheme() {
  document.documentElement.dataset.theme = effectiveTheme.value
}

async function refresh() {
  const [loadedSettings, loadedProfiles, loadedStatus] = await Promise.all([
    api.loadSettings(),
    api.loadProfiles(),
    api.getStatus(),
  ])
  settings.value = normalizeSettings(loadedSettings)
  profiles.value = normalizeProfiles(loadedProfiles)
  status.value = normalizeStatus(loadedStatus)
  ensureCurrentSelections()
  settingsLoaded.value = true
  await refreshPasswordState()
}

async function withBusy<T>(action: () => Promise<T>, okMessage: string) {
  loading.value = true
  message.value = ''
  try {
    const result = await action()
    message.value = okMessage
    return result
  } catch (error) {
    message.value = String(error)
    throw error
  } finally {
    loading.value = false
  }
}

async function saveSettingsOnly(okMessage = '配置已保存') {
  await withBusy(async () => {
    settings.value = await api.saveSettings(normalizeSettings(settings.value))
    ensureCurrentSelections()
  }, okMessage)
}

async function saveTunnel() {
  await withBusy(async () => {
    const tunnel = currentTunnel.value
    settings.value = await api.saveSettings(normalizeSettings(settings.value))
    if (tunnel.ssh.authMethod === 'password' && passwordInput.value) {
      await api.saveTunnelPassword(tunnel.id, passwordInput.value)
      savedPasswords.value = { ...savedPasswords.value, [tunnel.id]: true }
      passwordInput.value = ''
    }
    await refresh()
  }, '隧道配置已保存')
}

async function testTunnel() {
  await saveTunnel()
  await withBusy(async () => {
    await api.testSsh(currentTunnel.value.id)
  }, 'SSH 连接成功')
}

async function saveProfiles() {
  await withBusy(async () => {
    profiles.value = await api.saveProfiles(normalizeProfiles(profiles.value))
    await refresh()
  }, '服务配置已保存')
}

async function start() {
  await withBusy(async () => {
    status.value = normalizeStatus(await api.startProfile())
  }, '隧道已启动')
}

async function stop() {
  await withBusy(async () => {
    status.value = normalizeStatus(await api.stopProfile())
  }, '隧道已停止')
}

async function repairHosts() {
  await withBusy(async () => {
    await api.repairHosts()
    await refresh()
  }, 'hosts 已修复')
}

async function openLogDir() {
  await api.openLogDir()
}

async function setThemeMode(mode: ThemeMode) {
  settings.value.behavior.themeMode = mode
  applyTheme()
  if (!settingsLoaded.value) return
  await saveSettingsOnly('主题已保存')
}

async function updateLaunchAtLogin() {
  const enabled = settings.value.behavior.launchAtLogin
  await withBusy(async () => {
    settings.value.behavior.launchAtLogin = await api.setLaunchAtLogin(enabled)
    settings.value = await api.saveSettings(normalizeSettings(settings.value))
    ensureCurrentSelections()
  }, settings.value.behavior.launchAtLogin ? '开机启动已开启' : '开机启动已关闭')
}

async function refreshPasswordState(tunnelId = currentTunnel.value?.id) {
  if (!tunnelId) return
  try {
    const hasPassword = await api.hasTunnelPassword(tunnelId)
    savedPasswords.value = { ...savedPasswords.value, [tunnelId]: hasPassword }
  } catch {
    savedPasswords.value = { ...savedPasswords.value, [tunnelId]: false }
  }
}

async function clearTunnelPassword() {
  const tunnelId = currentTunnel.value.id
  await withBusy(async () => {
    await api.deleteTunnelPassword(tunnelId)
    savedPasswords.value = { ...savedPasswords.value, [tunnelId]: false }
    passwordInput.value = ''
  }, '已清除保存的 SSH 密码')
}

function addTunnel() {
  const nextId = nextTunnelId()
  settings.value.tunnels.push({
    id: nextId,
    name: `Tunnel ${settings.value.tunnels.length + 1}`,
    enabled: true,
    ssh: {
      ...defaultSsh(),
    },
  })
  settings.value.currentTunnelId = nextId
  passwordInput.value = ''
  message.value = '已添加隧道，请填写 SSH 信息后保存'
}

function removeTunnel(tunnelId: string) {
  const usedBy = profiles.value.profiles
    .flatMap((profile) => profile.services)
    .find((service) => service.tunnelId === tunnelId)
  if (usedBy) {
    message.value = `隧道正在被服务使用：${usedBy.name}`
    return
  }
  if (settings.value.tunnels.length <= 1) {
    message.value = '至少保留一个隧道'
    return
  }
  settings.value.tunnels = settings.value.tunnels.filter((tunnel) => tunnel.id !== tunnelId)
  settings.value.currentTunnelId = settings.value.tunnels[0]?.id || DEFAULT_TUNNEL_ID
}

function selectTunnel(tunnelId: string) {
  settings.value.currentTunnelId = tunnelId
  passwordInput.value = ''
  void refreshPasswordState(tunnelId)
}

function addService() {
  if (!newService.name || !newService.domain || !newService.localIp) {
    message.value = '请填写服务名、域名和本地 IP'
    return
  }
  currentProfile.value.services.push({
    ...newService,
    id: newService.id || slugify(newService.name),
    port: Number(newService.port),
    tunnelId: newService.tunnelId || currentTunnel.value.id,
  })
  newService.id = ''
  newService.name = ''
  newService.domain = ''
  newService.port = 3306
  newService.localIp = nextLocalIp()
  newService.tunnelId = currentTunnel.value.id
  newService.enabled = true
}

function removeService(id: string) {
  const profile = currentProfile.value
  profile.services = profile.services.filter((service) => service.id !== id)
}

function changeProfile(profileId: string) {
  settings.value.currentProfileId = profileId
  newService.localIp = nextLocalIp()
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function nextLocalIp() {
  const used = new Set(currentProfile.value.services.map((service) => service.localIp))
  for (let i = 10; i < 250; i += 1) {
    const candidate = `127.77.0.${i}`
    if (!used.has(candidate)) return candidate
  }
  return '127.77.1.10'
}

function nextTunnelId() {
  const used = new Set(settings.value.tunnels.map((tunnel) => tunnel.id))
  for (let i = 1; i < 100; i += 1) {
    const candidate = `tunnel-${i}`
    if (!used.has(candidate)) return candidate
  }
  return `tunnel-${Date.now()}`
}

function serviceStatus(id: string) {
  return status.value.services.find((item) => item.serviceId === id)
}

function statusText(id: string) {
  const item = serviceStatus(id)
  if (!item) return '未知'
  if (item.state === 'healthy') return '正常'
  if (item.state === 'disabled') return '禁用'
  if (item.state === 'stopped') return '未监听'
  if (item.state === 'checking') return '检查中'
  return '异常'
}

function statusClass(id: string) {
  return serviceStatus(id)?.state || 'stopped'
}

function normalizeSettings(value: AppSettings): AppSettings {
  const tunnels = value.tunnels?.length ? value.tunnels : [defaultTunnel()]
  const currentTunnelId = tunnels.some((tunnel) => tunnel.id === value.currentTunnelId)
    ? value.currentTunnelId
    : tunnels[0].id
  return {
    ...value,
    schemaVersion: 2,
    currentTunnelId,
    tunnels: tunnels.map((tunnel) => ({
      ...tunnel,
      enabled: tunnel.enabled ?? true,
      ssh: {
        ...defaultSsh(),
        ...tunnel.ssh,
      },
    })),
    behavior: {
      startMinimized: value.behavior?.startMinimized ?? false,
      autoStartProfile: value.behavior?.autoStartProfile ?? false,
      launchAtLogin: value.behavior?.launchAtLogin ?? false,
      autoRepairOnStart: value.behavior?.autoRepairOnStart ?? false,
      cleanupOnExit: value.behavior?.cleanupOnExit ?? true,
      themeMode: value.behavior?.themeMode || 'system',
    },
  }
}

function normalizeProfiles(value: ProfilesFile): ProfilesFile {
  const fallbackTunnelId = currentTunnel.value.id
  return {
    ...value,
    schemaVersion: 2,
    profiles: value.profiles.map((profile) => ({
      ...profile,
      services: profile.services.map((service) => ({
        ...service,
        tunnelId: service.tunnelId || fallbackTunnelId,
      })),
    })),
  }
}

function normalizeStatus(value: AppStatus): AppStatus {
  return {
    ...value,
    runningTunnelIds: value.runningTunnelIds || [],
    tunnels: value.tunnels || [],
    services: value.services || [],
  }
}

function ensureCurrentSelections() {
  if (!settings.value.tunnels.some((tunnel) => tunnel.id === settings.value.currentTunnelId)) {
    settings.value.currentTunnelId = settings.value.tunnels[0]?.id || DEFAULT_TUNNEL_ID
  }
  if (!profiles.value.profiles.some((profile) => profile.id === settings.value.currentProfileId)) {
    settings.value.currentProfileId = profiles.value.profiles[0]?.id || 'default'
  }
  if (!newService.tunnelId || !settings.value.tunnels.some((tunnel) => tunnel.id === newService.tunnelId)) {
    newService.tunnelId = settings.value.currentTunnelId
  }
}

watch(effectiveTheme, applyTheme)

onMounted(async () => {
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = mediaQuery.matches
  mediaListener = (event: MediaQueryListEvent) => {
    systemDark.value = event.matches
  }
  mediaQuery.addEventListener('change', mediaListener)
  await refresh()
  await nextTick()
  applyTheme()
})

onBeforeUnmount(() => {
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener)
  }
})
</script>

<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <Cable :size="26" />
        <div>
          <strong>TunnelDesk</strong>
          <span>Dev tunnel manager</span>
        </div>
      </div>
      <nav>
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="{ active: activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" :size="18" />
          {{ tab.label }}
        </button>
      </nav>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div class="title-stack">
          <div class="profile-line">
            <select :value="settings.currentProfileId" @change="changeProfile(($event.target as HTMLSelectElement).value)">
              <option v-for="profile in profiles.profiles" :key="profile.id" :value="profile.id">
                {{ profile.name }}
              </option>
            </select>
            <span :class="['pill', status.running ? 'ok' : 'muted']">{{ runningLabel }}</span>
            <span :class="['pill', status.isAdmin ? 'ok' : 'warn']">
              {{ status.isAdmin ? '管理员权限' : '非管理员' }}
            </span>
          </div>
          <span class="subtitle">
            {{ activeServices.length }} 个启用服务 · {{ profileTunnelIds.length }} 条隧道
          </span>
        </div>
        <div class="actions">
          <button class="secondary" :disabled="loading" @click="refresh">
            <RotateCcw :size="16" />
            刷新
          </button>
          <button v-if="!status.running" class="primary" :disabled="loading" @click="start">
            <Loader2 v-if="loading" :size="16" class="spin" />
            <Cable v-else :size="16" />
            启动
          </button>
          <button v-else class="danger" :disabled="loading" @click="stop">
            <Square :size="16" />
            停止
          </button>
        </div>
      </header>

      <section v-if="message" class="notice">{{ message }}</section>

      <section v-if="activeTab === 'overview'" class="page">
        <div class="metric-grid">
          <div class="metric">
            <span>Profile</span>
            <strong>{{ currentProfile?.name || 'Profile' }}</strong>
          </div>
          <div class="metric">
            <span>hosts</span>
            <strong>{{ status.hostsBlockPresent ? '已写入' : '干净' }}</strong>
          </div>
          <div class="metric">
            <span>Running tunnels</span>
            <strong>{{ status.runningTunnelIds.length }}</strong>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">
            <Database :size="18" />
            服务状态
          </div>
          <div class="table">
            <div class="row header">
              <span>名称</span>
              <span>域名</span>
              <span>端口</span>
              <span>隧道</span>
              <span>状态</span>
            </div>
            <div v-for="service in currentProfile.services" :key="service.id" class="row">
              <span>{{ service.name }}</span>
              <span class="mono">{{ service.domain }}</span>
              <span>{{ service.port }}</span>
              <span>{{ tunnelName(service.tunnelId) }}</span>
              <span :class="['state-dot', statusClass(service.id)]">{{ statusText(service.id) }}</span>
            </div>
            <div v-if="!currentProfile.services.length" class="empty">暂无服务配置</div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'tunnels'" class="page two-col tunnel-page">
        <div class="panel tunnel-list">
          <div class="panel-title">
            <KeyRound :size="18" />
            隧道
          </div>
          <button
            v-for="tunnel in settings.tunnels"
            :key="tunnel.id"
            :class="['tunnel-item', { active: tunnel.id === currentTunnel.id }]"
            @click="selectTunnel(tunnel.id)"
          >
            <span>
              <strong>{{ tunnel.name }}</strong>
              <small>{{ tunnel.ssh.host || '未配置 Host' }}:{{ tunnel.ssh.port }}</small>
            </span>
            <span :class="['mini-state', tunnelRunning(tunnel.id) ? 'ok' : 'muted']">
              {{ tunnelRunning(tunnel.id) ? '运行' : tunnel.enabled ? '停止' : '禁用' }}
            </span>
          </button>
          <div class="button-row">
            <button class="secondary" @click="addTunnel">
              <Plus :size="16" />
              添加隧道
            </button>
            <button class="danger-ghost" @click="removeTunnel(currentTunnel.id)">
              <Trash2 :size="16" />
              删除
            </button>
          </div>
        </div>

        <div class="tunnel-config-grid">
          <div class="panel">
            <div class="panel-title">
              <Settings :size="18" />
              隧道配置
            </div>
            <label>
              名称
              <input v-model="currentTunnel.name" />
            </label>
            <label>
              ID
              <input v-model="currentTunnel.id" disabled />
            </label>
            <label class="check">
              <input v-model="currentTunnel.enabled" type="checkbox" />
              启用此隧道
            </label>
            <label>
              Host
              <input v-model="currentTunnel.ssh.host" />
            </label>
            <label>
              SSH Port
              <input v-model.number="currentTunnel.ssh.port" type="number" min="1" max="65535" />
            </label>
            <label>
              Username
              <input v-model="currentTunnel.ssh.username" />
            </label>
            <label>
              认证方式
              <select v-model="currentTunnel.ssh.authMethod">
                <option value="password">密码</option>
                <option value="privateKey">私钥</option>
                <option value="agent">ssh-agent</option>
              </select>
            </label>
            <div v-if="currentTunnel.ssh.authMethod === 'password'" class="secret-field">
              <label>
                SSH 密码
                <input
                  v-model="passwordInput"
                  type="password"
                  autocomplete="new-password"
                  placeholder="留空则保留已保存密码"
                />
              </label>
              <div class="secret-status">
                <span :class="['mini-state', currentTunnelHasPassword ? 'ok' : 'muted']">
                  {{ currentTunnelHasPassword ? '已保存到系统凭据库' : '未保存密码' }}
                </span>
                <button
                  v-if="currentTunnelHasPassword"
                  class="danger-ghost"
                  :disabled="loading"
                  @click="clearTunnelPassword"
                >
                  <Trash2 :size="16" />
                  清除密码
                </button>
              </div>
            </div>
            <label v-if="currentTunnel.ssh.authMethod === 'privateKey'">
              Identity File
              <input v-model="currentTunnel.ssh.identityFile" />
            </label>
            <div class="button-row">
              <button class="primary" :disabled="loading" @click="saveTunnel">
                <Save :size="16" />
                保存
              </button>
              <button class="secondary" :disabled="loading" @click="testTunnel">
                <CheckCircle2 :size="16" />
                测试
              </button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-title">
              <Settings :size="18" />
              高级
            </div>
            <label>
              ServerAliveInterval
              <input v-model.number="currentTunnel.ssh.serverAliveInterval" type="number" min="5" />
            </label>
            <label>
              ServerAliveCountMax
              <input v-model.number="currentTunnel.ssh.serverAliveCountMax" type="number" min="1" />
            </label>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'services'" class="page">
        <div class="panel">
          <div class="panel-title">
            <Database :size="18" />
            服务配置
          </div>
          <div class="service-form">
            <input v-model="newService.name" placeholder="服务名" />
            <input v-model="newService.domain" placeholder="真实域名" />
            <input v-model.number="newService.port" type="number" placeholder="端口" />
            <input v-model="newService.localIp" placeholder="127.77.0.x" />
            <select v-model="newService.tunnelId">
              <option v-for="tunnel in settings.tunnels" :key="tunnel.id" :value="tunnel.id">
                {{ tunnel.name }}
              </option>
            </select>
            <button class="secondary" @click="addService">
              <Plus :size="16" />
              添加
            </button>
          </div>

          <div v-if="currentProfile.services.length" class="table edit">
            <div class="row header">
              <span>启用</span>
              <span>名称</span>
              <span>域名</span>
              <span>端口</span>
              <span>本地 IP</span>
              <span>隧道</span>
              <span>操作</span>
            </div>
            <div v-for="service in currentProfile.services" :key="service.id" class="row">
              <input v-model="service.enabled" type="checkbox" />
              <input v-model="service.name" />
              <input v-model="service.domain" />
              <input v-model.number="service.port" type="number" />
              <input v-model="service.localIp" />
              <select v-model="service.tunnelId">
                <option v-for="tunnel in settings.tunnels" :key="tunnel.id" :value="tunnel.id">
                  {{ tunnel.name }}
                </option>
              </select>
              <button class="icon danger-ghost" @click="removeService(service.id)">
                <Trash2 :size="16" />
              </button>
            </div>
          </div>
          <div v-else class="empty empty-panel">暂无服务配置</div>

          <div class="button-row">
            <button class="primary" :disabled="loading" @click="saveProfiles">
              <Save :size="16" />
              保存服务
            </button>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'settings'" class="page settings-page">
        <div class="panel">
          <div class="panel-title">
            <Settings :size="18" />
            应用设置
          </div>
          <div class="settings-grid">
            <div class="setting-row">
              <div>
                <strong>主题</strong>
                <span>跟随系统或固定浅色/深色模式</span>
              </div>
              <div class="theme-picker" role="group" aria-label="Theme mode">
                <button
                  v-for="option in themeOptions"
                  :key="option.id"
                  :class="{ active: settings.behavior.themeMode === option.id }"
                  @click="setThemeMode(option.id)"
                >
                  <component :is="option.icon" :size="16" />
                  {{ option.label }}
                </button>
              </div>
            </div>

            <label class="setting-row check">
              <div>
                <strong>启动后最小化</strong>
                <span>打开应用时直接进入后台窗口状态</span>
              </div>
              <input
                v-model="settings.behavior.startMinimized"
                type="checkbox"
                @change="saveSettingsOnly('应用设置已保存')"
              />
            </label>

            <label class="setting-row check">
              <div>
                <strong>打开软件后自动启动</strong>
                <span>应用启动后自动启动当前 Profile 的全部启用服务</span>
              </div>
              <input
                v-model="settings.behavior.autoStartProfile"
                type="checkbox"
                @change="saveSettingsOnly('应用设置已保存')"
              />
            </label>

            <label class="setting-row check">
              <div>
                <strong>开机启动</strong>
                <span>登录 Windows 后自动打开 TunnelDesk</span>
              </div>
              <input
                v-model="settings.behavior.launchAtLogin"
                type="checkbox"
                @change="updateLaunchAtLogin"
              />
            </label>

            <label class="setting-row check">
              <div>
                <strong>启动时自动修复 hosts</strong>
                <span>应用启动后自动清理 TunnelDesk 管理的 hosts 标记块</span>
              </div>
              <input
                v-model="settings.behavior.autoRepairOnStart"
                type="checkbox"
                @change="saveSettingsOnly('应用设置已保存')"
              />
            </label>

            <label class="setting-row check">
              <div>
                <strong>退出时清理 hosts</strong>
                <span>停止或退出应用时移除 TunnelDesk 管理的 hosts 映射</span>
              </div>
              <input
                v-model="settings.behavior.cleanupOnExit"
                type="checkbox"
                @change="saveSettingsOnly('应用设置已保存')"
              />
            </label>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'diagnostics'" class="page two-col">
        <div class="panel">
          <div class="panel-title">
            <ShieldAlert :size="18" />
            诊断
          </div>
          <div class="diag-row">
            <span>管理员权限</span>
            <strong>{{ status.isAdmin ? 'OK' : '需要管理员启动' }}</strong>
          </div>
          <div class="diag-row">
            <span>hosts 标记块</span>
            <strong>{{ status.hostsBlockPresent ? '存在' : '不存在' }}</strong>
          </div>
          <div class="diag-row">
            <span>运行状态</span>
            <strong>{{ runningLabel }}</strong>
          </div>
          <div class="diag-row">
            <span>运行隧道</span>
            <strong>{{ status.runningTunnelIds.map(tunnelName).join(', ') || '无' }}</strong>
          </div>
          <div class="button-row">
            <button class="secondary" @click="repairHosts">
              <RotateCcw :size="16" />
              修复 hosts
            </button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title">
            <KeyRound :size="18" />
            隧道状态
          </div>
          <div v-for="tunnel in status.tunnels" :key="tunnel.tunnelId" class="diag-row">
            <span>{{ tunnel.name }}</span>
            <strong>{{ tunnel.message }}</strong>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'logs'" class="page">
        <div class="panel">
          <div class="panel-title">
            <FileText :size="18" />
            日志
          </div>
          <button class="secondary" @click="openLogDir">打开日志目录</button>
        </div>
      </section>
    </main>
  </div>
</template>
