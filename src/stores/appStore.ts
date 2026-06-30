import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api } from '@/shared/api/tauri'
import { commandErrorMessage } from '@/shared/api/commandError'
import { DEFAULT_PROFILE_ID, DEFAULT_TUNNEL_ID, defaultProfiles, defaultSettings, defaultStatus } from '@/shared/domain/defaults'
import { normalizeProfiles, normalizeSettings, normalizeStatus } from '@/shared/domain/normalize'
import { createTunnel, nextLocalIp, slugify, tunnelName as resolveTunnelName } from '@/shared/domain/tunnelFactory'
import { findDuplicateListener } from '@/shared/domain/validators'
import type { AppSettings, AppStatus, ProfilesFile, ServiceConfig, TunnelConfig } from '@/shared/types'
import { usePasswordStore } from './passwordStore'

type MessageType = 'success' | 'error' | 'info'

export const useAppStore = defineStore('app', () => {
  const settings = ref<AppSettings>(defaultSettings())
  const profiles = ref<ProfilesFile>(defaultProfiles())
  const status = ref<AppStatus>(defaultStatus())
  const loading = ref(false)
  const message = ref('')
  const messageType = ref<MessageType>('info')
  const initialized = ref(false)

  const currentProfile = computed(() => {
    return profiles.value.profiles.find((profile) => profile.id === settings.value.currentProfileId) || profiles.value.profiles[0]
  })

  const currentTunnel = computed<TunnelConfig>(() => {
    return settings.value.tunnels.find((tunnel) => tunnel.id === settings.value.currentTunnelId) || settings.value.tunnels[0]
  })

  const activeServices = computed(() => currentProfile.value.services.filter((service) => service.enabled))
  const profileTunnelIds = computed(() => Array.from(new Set(activeServices.value.map((service) => service.tunnelId))).filter(Boolean))

  function setMessage(type: MessageType, value: string) {
    messageType.value = type
    message.value = value
  }

  function clearMessage() {
    message.value = ''
  }

  function ensureCurrentSelections() {
    if (!settings.value.tunnels.length) {
      settings.value.tunnels = [createTunnel([])]
    }
    if (!settings.value.tunnels.some((tunnel) => tunnel.id === settings.value.currentTunnelId)) {
      settings.value.currentTunnelId = settings.value.tunnels[0]?.id || DEFAULT_TUNNEL_ID
    }
    if (!profiles.value.profiles.length) {
      profiles.value = defaultProfiles()
    }
    if (!profiles.value.profiles.some((profile) => profile.id === settings.value.currentProfileId)) {
      settings.value.currentProfileId = profiles.value.profiles[0]?.id || DEFAULT_PROFILE_ID
    }
  }

  function applyConfig(loadedSettings: AppSettings, loadedProfiles: ProfilesFile) {
    settings.value = normalizeSettings(loadedSettings)
    profiles.value = normalizeProfiles(loadedProfiles, settings.value.currentTunnelId)
    ensureCurrentSelections()
    initialized.value = true
  }

  async function withBusy<T>(action: () => Promise<T>, okMessage: string): Promise<T | undefined> {
    loading.value = true
    clearMessage()
    try {
      const result = await action()
      setMessage('success', okMessage)
      return result
    } catch (error) {
      setMessage('error', commandErrorMessage(error))
      return undefined
    } finally {
      loading.value = false
    }
  }

  async function refreshStatus() {
    status.value = normalizeStatus(await api.getStatus())
  }

  async function refreshPasswordState() {
    await usePasswordStore().refresh(currentTunnel.value.id)
  }

  async function refreshLaunchAtLoginState() {
    settings.value.behavior.launchAtLogin = await api.launchAtLoginEnabled()
  }

  async function bootstrap() {
    try {
      const [loadedSettings, loadedProfiles] = await Promise.all([api.loadSettings(), api.loadProfiles()])
      applyConfig(loadedSettings, loadedProfiles)
    } catch (error) {
      setMessage('error', commandErrorMessage(error))
      return
    }

    void refreshStatus().catch((error) => {
      setMessage('error', commandErrorMessage(error))
    })
  }

  async function refresh() {
    const [loadedSettings, loadedProfiles, loadedStatus] = await Promise.all([api.loadSettings(), api.loadProfiles(), api.getStatus()])
    applyConfig(loadedSettings, loadedProfiles)
    status.value = normalizeStatus(loadedStatus)
    await refreshPasswordState()
  }

  async function reload() {
    await withBusy(refresh, '状态已刷新')
  }

  async function persistSettings() {
    settings.value = normalizeSettings(await api.saveSettings(normalizeSettings(settings.value)))
    ensureCurrentSelections()
  }

  async function saveSettingsOnly(okMessage = '配置已保存') {
    await withBusy(persistSettings, okMessage)
  }

  async function updateLaunchAtLogin() {
    const enabled = settings.value.behavior.launchAtLogin
    await withBusy(async () => {
      settings.value.behavior.launchAtLogin = await api.setLaunchAtLogin(enabled)
      await persistSettings()
    }, settings.value.behavior.launchAtLogin ? '开机启动已开启' : '开机启动已关闭')
  }

  async function persistTunnel(password?: string) {
    const tunnel = currentTunnel.value
    await persistSettings()
    if (tunnel.ssh.authMethod === 'password' && password) {
      await usePasswordStore().save(tunnel.id, password)
    }
    await refresh()
  }

  async function saveTunnel(password?: string) {
    await withBusy(() => persistTunnel(password), '隧道配置已保存')
  }

  async function testTunnel(password?: string) {
    await withBusy(async () => {
      const tunnelId = currentTunnel.value.id
      await persistTunnel(password)
      await api.testSsh(tunnelId)
    }, 'SSH 连接成功')
  }

  async function clearTunnelPassword(tunnelId: string) {
    await withBusy(async () => {
      await usePasswordStore().clear(tunnelId)
    }, '已清除保存的 SSH 密码')
  }

  async function saveProfiles() {
    await withBusy(async () => {
      profiles.value = normalizeProfiles(await api.saveProfiles(normalizeProfiles(profiles.value, currentTunnel.value.id)), currentTunnel.value.id)
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
    await withBusy(api.openLogDir, '已打开日志目录')
  }

  function selectTunnel(tunnelId: string) {
    settings.value.currentTunnelId = tunnelId
    void usePasswordStore().refresh(tunnelId)
  }

  function addTunnel() {
    const tunnel = createTunnel(settings.value.tunnels)
    settings.value.tunnels.push(tunnel)
    settings.value.currentTunnelId = tunnel.id
    setMessage('info', '已添加隧道，请填写 SSH 信息后保存')
  }

  function removeTunnel(tunnelId: string) {
    const usedBy = profiles.value.profiles.flatMap((profile) => profile.services).find((service) => service.tunnelId === tunnelId)
    if (usedBy) {
      setMessage('error', `隧道正在被服务使用：${usedBy.name}`)
      return
    }
    if (settings.value.tunnels.length <= 1) {
      setMessage('error', '至少保留一个隧道')
      return
    }
    settings.value.tunnels = settings.value.tunnels.filter((tunnel) => tunnel.id !== tunnelId)
    settings.value.currentTunnelId = settings.value.tunnels[0]?.id || DEFAULT_TUNNEL_ID
  }

  function addService(draft: ServiceConfig): boolean {
    const service: ServiceConfig = {
      ...draft,
      id: draft.id || slugify(draft.name),
      port: Number(draft.port),
      tunnelId: draft.tunnelId || currentTunnel.value.id,
      enabled: draft.enabled ?? true,
    }
    if (!service.name || !service.domain || !service.localIp) {
      setMessage('error', '请填写服务名、域名和本地 IP')
      return false
    }
    if (currentProfile.value.services.some((item) => item.id === service.id)) {
      setMessage('error', `服务 ID 已存在：${service.id}`)
      return false
    }
    const duplicate = findDuplicateListener(currentProfile.value.services, service)
    if (duplicate) {
      setMessage('error', `监听地址已被 ${duplicate.name} 使用`)
      return false
    }
    currentProfile.value.services.push(service)
    setMessage('info', '已添加服务，请保存后生效')
    return true
  }

  function removeService(serviceId: string) {
    currentProfile.value.services = currentProfile.value.services.filter((service) => service.id !== serviceId)
  }

  function nextServiceLocalIp() {
    return nextLocalIp(currentProfile.value.services)
  }

  function tunnelName(tunnelId: string) {
    return resolveTunnelName(settings.value.tunnels, tunnelId)
  }

  function tunnelRunning(tunnelId: string) {
    return status.value.runningTunnelIds.includes(tunnelId)
  }

  return {
    settings,
    profiles,
    status,
    loading,
    message,
    messageType,
    initialized,
    currentProfile,
    currentTunnel,
    activeServices,
    profileTunnelIds,
    setMessage,
    clearMessage,
    bootstrap,
    refresh,
    refreshStatus,
    reload,
    refreshLaunchAtLoginState,
    refreshPasswordState,
    saveSettingsOnly,
    updateLaunchAtLogin,
    saveTunnel,
    testTunnel,
    clearTunnelPassword,
    saveProfiles,
    start,
    stop,
    repairHosts,
    openLogDir,
    selectTunnel,
    addTunnel,
    removeTunnel,
    addService,
    removeService,
    nextServiceLocalIp,
    tunnelName,
    tunnelRunning,
  }
})
