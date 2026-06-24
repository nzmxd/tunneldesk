<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  Activity,
  Cable,
  CheckCircle2,
  Database,
  FileText,
  KeyRound,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Settings,
  ShieldAlert,
  Square,
  Trash2,
} from '@lucide/vue'
import { api } from './api'
import type { AppSettings, AppStatus, ProfilesFile, ServiceConfig, ServiceProfile } from './types'

const tabs = [
  { id: 'overview', label: '总览', icon: Activity },
  { id: 'ssh', label: 'SSH', icon: KeyRound },
  { id: 'services', label: '服务', icon: Database },
  { id: 'diagnostics', label: '诊断', icon: ShieldAlert },
  { id: 'logs', label: '日志', icon: FileText },
] as const

type TabId = (typeof tabs)[number]['id']

const activeTab = ref<TabId>('overview')
const loading = ref(false)
const message = ref('')
const passwordInput = ref('')

const settings = ref<AppSettings>({
  schemaVersion: 1,
  currentProfileId: 'default',
  ssh: {
    host: '',
    port: 22,
    username: '',
    authMethod: 'password',
    identityFile: '',
    passwordCredentialKey: '',
    keyPassphraseCredentialKey: '',
    serverAliveInterval: 30,
    serverAliveCountMax: 3,
  },
  behavior: {
    startMinimized: false,
    autoRepairOnStart: false,
    cleanupOnExit: true,
  },
})

const profiles = ref<ProfilesFile>({
  schemaVersion: 1,
  profiles: [{ id: 'default', name: 'Default Profile', enabled: true, services: [] }],
})

const status = ref<AppStatus>({
  running: false,
  currentProfileId: 'default',
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
  enabled: true,
})

const currentProfile = computed<ServiceProfile>(() => {
  return (
    profiles.value.profiles.find((profile) => profile.id === settings.value.currentProfileId) ||
    profiles.value.profiles[0]
  )
})

const runningLabel = computed(() => (status.value.running ? '运行中' : '已停止'))

function credentialKey(kind: 'password' | 'key-passphrase') {
  const ssh = settings.value.ssh
  return `TunnelDesk:ssh:${ssh.host}:${ssh.port}:${ssh.username}:${kind}`
}

async function refresh() {
  const [loadedSettings, loadedProfiles, loadedStatus] = await Promise.all([
    api.loadSettings(),
    api.loadProfiles(),
    api.getStatus(),
  ])
  settings.value = loadedSettings
  profiles.value = loadedProfiles
  status.value = loadedStatus
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

async function saveSsh() {
  await withBusy(async () => {
    if (settings.value.ssh.authMethod === 'password') {
      settings.value.ssh.passwordCredentialKey = credentialKey('password')
      if (passwordInput.value) {
        await api.saveSecret({
          key: settings.value.ssh.passwordCredentialKey,
          value: passwordInput.value,
        })
        passwordInput.value = ''
      }
    }
    settings.value = await api.saveSettings(settings.value)
    await refresh()
  }, 'SSH 配置已保存')
}

async function testSsh() {
  await saveSsh()
  await withBusy(async () => {
    await api.testSsh(settings.value)
  }, 'SSH 连接成功')
}

async function saveProfiles() {
  await withBusy(async () => {
    profiles.value = await api.saveProfiles(profiles.value)
    await refresh()
  }, '服务配置已保存')
}

async function start() {
  await withBusy(async () => {
    status.value = await api.startProfile()
  }, '隧道已启动')
}

async function stop() {
  await withBusy(async () => {
    status.value = await api.stopProfile()
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

function addService() {
  if (!newService.name || !newService.domain || !newService.localIp) {
    message.value = '请填写服务名、域名和本地 IP'
    return
  }
  currentProfile.value.services.push({
    ...newService,
    id: newService.id || slugify(newService.name),
    port: Number(newService.port),
  })
  newService.id = ''
  newService.name = ''
  newService.domain = ''
  newService.port = 3306
  newService.localIp = nextLocalIp()
  newService.enabled = true
}

function removeService(id: string) {
  const profile = currentProfile.value
  profile.services = profile.services.filter((service) => service.id !== id)
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

onMounted(refresh)
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
        <div>
          <h1>{{ currentProfile?.name || 'Profile' }}</h1>
          <span :class="['pill', status.running ? 'ok' : 'muted']">{{ runningLabel }}</span>
          <span :class="['pill', status.isAdmin ? 'ok' : 'warn']">
            {{ status.isAdmin ? '管理员权限' : '非管理员' }}
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
            <span>SSH</span>
            <strong>{{ settings.ssh.host }}:{{ settings.ssh.port }}</strong>
          </div>
          <div class="metric">
            <span>hosts</span>
            <strong>{{ status.hostsBlockPresent ? '已写入' : '干净' }}</strong>
          </div>
          <div class="metric">
            <span>Profile</span>
            <strong>{{ currentProfile.services.length }} services</strong>
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
              <span>本地 IP</span>
              <span>状态</span>
            </div>
            <div v-for="service in currentProfile.services" :key="service.id" class="row">
              <span>{{ service.name }}</span>
              <span class="mono">{{ service.domain }}</span>
              <span>{{ service.port }}</span>
              <span class="mono">{{ service.localIp }}</span>
              <span :class="['state-dot', statusClass(service.id)]">{{ statusText(service.id) }}</span>
            </div>
            <div v-if="!currentProfile.services.length" class="empty">暂无服务配置</div>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'ssh'" class="page two-col">
        <div class="panel">
          <div class="panel-title">
            <KeyRound :size="18" />
            SSH 配置
          </div>
          <label>
            Host
            <input v-model="settings.ssh.host" />
          </label>
          <label>
            SSH Port
            <input v-model.number="settings.ssh.port" type="number" min="1" max="65535" />
          </label>
          <label>
            Username
            <input v-model="settings.ssh.username" />
          </label>
          <label>
            认证方式
            <select v-model="settings.ssh.authMethod">
              <option value="password">密码</option>
              <option value="privateKey">私钥</option>
              <option value="agent">ssh-agent</option>
            </select>
          </label>
          <label v-if="settings.ssh.authMethod === 'password'">
            SSH 密码
            <input v-model="passwordInput" type="password" autocomplete="new-password" />
          </label>
          <label v-if="settings.ssh.authMethod === 'privateKey'">
            Identity File
            <input v-model="settings.ssh.identityFile" />
          </label>
          <div class="button-row">
            <button class="primary" :disabled="loading" @click="saveSsh">
              <Save :size="16" />
              保存
            </button>
            <button class="secondary" :disabled="loading" @click="testSsh">
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
            <input v-model.number="settings.ssh.serverAliveInterval" type="number" min="5" />
          </label>
          <label>
            ServerAliveCountMax
            <input v-model.number="settings.ssh.serverAliveCountMax" type="number" min="1" />
          </label>
          <label class="check">
            <input v-model="settings.behavior.cleanupOnExit" type="checkbox" />
            退出时清理 hosts
          </label>
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
            <button class="secondary" @click="addService">
              <Plus :size="16" />
              添加
            </button>
          </div>

          <div class="table edit">
            <div class="row header">
              <span>启用</span>
              <span>名称</span>
              <span>域名</span>
              <span>端口</span>
              <span>本地 IP</span>
              <span></span>
            </div>
            <div v-for="service in currentProfile.services" :key="service.id" class="row">
              <input v-model="service.enabled" type="checkbox" />
              <input v-model="service.name" />
              <input v-model="service.domain" />
              <input v-model.number="service.port" type="number" />
              <input v-model="service.localIp" />
              <button class="icon danger-ghost" @click="removeService(service.id)">
                <Trash2 :size="16" />
              </button>
            </div>
          </div>

          <div class="button-row">
            <button class="primary" :disabled="loading" @click="saveProfiles">
              <Save :size="16" />
              保存服务
            </button>
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
          <div class="button-row">
            <button class="secondary" @click="repairHosts">
              <RotateCcw :size="16" />
              修复 hosts
            </button>
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
