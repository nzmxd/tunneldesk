import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { open, save } from '@tauri-apps/plugin-dialog'
import { api } from '@/shared/api/tauri'
import { commandErrorMessage } from '@/shared/api/commandError'
import { DEFAULT_PROFILE_ID, DEFAULT_TUNNEL_ID, defaultProfiles, defaultSettings, defaultStatus } from '@/shared/domain/defaults'
import { normalizeProfiles, normalizeSettings, normalizeStatus } from '@/shared/domain/normalize'
import { validateProfileStart, type StartupValidationIssue } from '@/shared/domain/startupValidation'
import { createTunnel, nextLocalIp, slugify, tunnelName as resolveTunnelName } from '@/shared/domain/tunnelFactory'
import { findDuplicateListener } from '@/shared/domain/validators'
import type { AppSettings, AppStatus, ConfigBackupInfo, ProfilesFile, ProfilesImportApplyResult, ProfilesImportSession, ServiceConfig, ServiceProfile, TunnelConfig, TunnelMapping } from '@/shared/types'
import { usePasswordStore } from './passwordStore'

type MessageType = 'success' | 'error' | 'info'
type MoveDirection = -1 | 1
type DropPlacement = 'before' | 'after'

interface ServiceGroupView {
  key: string
  value: string
  label: string
  services: ServiceConfig[]
}

export const useAppStore = defineStore('app', () => {
  const settings = ref<AppSettings>(defaultSettings())
  const profiles = ref<ProfilesFile>(defaultProfiles())
  const status = ref<AppStatus>(defaultStatus())
  const loading = ref(false)
  const message = ref('')
  const messageType = ref<MessageType>('info')
  const initialized = ref(false)
  const savedProfilesSnapshot = ref('')
  const savedProfilesBaseline = ref<ProfilesFile>(defaultProfiles())
  const unsavedProfilesConfirmOpen = ref(false)
  const pendingUnsavedProfilesAction = ref<(() => Promise<void>) | null>(null)
  const startupValidationIssues = ref<StartupValidationIssue[]>([])
  const startupValidationOpen = ref(false)
  const configBackups = ref<ConfigBackupInfo[]>([])

  const currentProfile = computed(() => {
    return profiles.value.profiles.find((profile) => profile.id === settings.value.currentProfileId) || profiles.value.profiles[0]
  })

  const currentTunnel = computed<TunnelConfig>(() => {
    return settings.value.tunnels.find((tunnel) => tunnel.id === settings.value.currentTunnelId) || settings.value.tunnels[0]
  })

  const activeServices = computed(() => currentProfile.value.services.filter((service) => service.enabled))
  const profileTunnelIds = computed(() => Array.from(new Set(activeServices.value.map((service) => service.tunnelId))).filter(Boolean))
  const orderedCurrentServices = computed(() => orderServices(currentProfile.value.services))
  const serviceGroups = computed<ServiceGroupView[]>(() => {
    const groups = new Map<string, ServiceGroupView>()
    for (const service of orderedCurrentServices.value) {
      const value = normalizeServiceGroup(service.group)
      const key = value || '__ungrouped'
      const group = groups.get(key) || {
        key,
        value,
        label: serviceGroupLabel(value),
        services: [],
      }
      group.services.push(service)
      groups.set(key, group)
    }
    return Array.from(groups.values())
  })
  const serviceGroupOptions = computed(() =>
    Array.from(new Set(currentProfile.value.services.map((service) => normalizeServiceGroup(service.group)).filter(Boolean)))
      .sort(compareText)
      .map((value) => ({ value })),
  )
  const profilesDirty = computed(() => Boolean(savedProfilesSnapshot.value) && profilesSnapshot(profilesForSave()) !== savedProfilesSnapshot.value)

  function setMessage(type: MessageType, value: string) {
    messageType.value = type
    message.value = value
  }

  function clearMessage() {
    message.value = ''
  }

  function syncProfilesSnapshot() {
    const baseline = profilesForSave()
    savedProfilesBaseline.value = cloneProfiles(baseline)
    savedProfilesSnapshot.value = profilesSnapshot(baseline)
  }

  function restoreProfilesSnapshot() {
    profiles.value = cloneProfiles(savedProfilesBaseline.value)
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
    syncProfilesSnapshot()
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
    await runAfterUnsavedProfilesConfirm(() => withBusy(refresh, '状态已刷新').then(() => undefined))
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
      profiles.value = normalizeProfiles(await api.saveProfiles(profilesForSave()), currentTunnel.value.id)
      syncProfilesSnapshot()
      await refresh()
    }, '服务配置已保存')
  }

  function profilesForSave(): ProfilesFile {
    const normalized = normalizeProfiles(profiles.value, currentTunnel.value.id)
    return {
      ...normalized,
      profiles: normalized.profiles.map((profile) => ({
        ...profile,
        services: orderServices(profile.services).map((service, index) => ({
          ...service,
          group: normalizeServiceGroup(service.group),
          sortOrder: (index + 1) * 10,
        })),
      })),
    }
  }

  function nextProfileId(name: string) {
    const base = slugify(name) || 'profile'
    const used = new Set(profiles.value.profiles.map((profile) => profile.id))
    if (!used.has(base)) return base
    for (let index = 2; index < 100; index += 1) {
      const candidate = `${base}-${index}`
      if (!used.has(candidate)) return candidate
    }
    return `${base}-${Date.now()}`
  }

  async function createProfile(name: string): Promise<boolean> {
    if (status.value.running) {
      setMessage('error', '运行中不能新建 Profile，请先停止隧道')
      return false
    }
    const trimmedName = name.trim()
    if (!trimmedName) {
      setMessage('error', '请填写 Profile 名称')
      return false
    }
    if (profiles.value.profiles.some((profile) => profile.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      setMessage('error', `Profile 已存在：${trimmedName}`)
      return false
    }

    const profile: ServiceProfile = {
      id: nextProfileId(trimmedName),
      name: trimmedName,
      enabled: true,
      services: [],
    }
    const created = await withBusy(async () => {
      const nextProfiles = normalizeProfiles(
        {
          ...profiles.value,
          profiles: [...profiles.value.profiles, profile],
        },
        currentTunnel.value.id,
      )
      profiles.value = normalizeProfiles(await api.saveProfiles(nextProfiles), currentTunnel.value.id)
      syncProfilesSnapshot()
      settings.value.currentProfileId = profile.id
      await persistSettings()
      await refreshStatus()
      return true
    }, 'Profile 已创建')

    return Boolean(created)
  }

  async function renameProfile(profileId: string, name: string): Promise<boolean> {
    if (status.value.running) {
      setMessage('error', '运行中不能重命名 Profile，请先停止隧道')
      return false
    }
    const targetProfile = profiles.value.profiles.find((profile) => profile.id === profileId)
    if (!targetProfile) {
      setMessage('error', `Profile 不存在：${profileId}`)
      return false
    }
    const trimmedName = name.trim()
    if (!trimmedName) {
      setMessage('error', '请填写 Profile 名称')
      return false
    }
    if (profiles.value.profiles.some((profile) => profile.id !== profileId && profile.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
      setMessage('error', `Profile 已存在：${trimmedName}`)
      return false
    }
    if (targetProfile.name === trimmedName) {
      setMessage('info', 'Profile 名称未变化')
      return true
    }

    const renamed = await withBusy(async () => {
      const nextProfiles = normalizeProfiles(
        {
          ...profiles.value,
          profiles: profiles.value.profiles.map((profile) => (profile.id === profileId ? { ...profile, name: trimmedName } : profile)),
        },
        currentTunnel.value.id,
      )
      profiles.value = normalizeProfiles(await api.saveProfiles(nextProfiles), currentTunnel.value.id)
      syncProfilesSnapshot()
      await refreshStatus()
      return true
    }, 'Profile 已重命名')

    return Boolean(renamed)
  }

  async function deleteProfile(profileId: string): Promise<boolean> {
    if (status.value.running) {
      setMessage('error', '运行中不能删除 Profile，请先停止隧道')
      return false
    }
    if (profiles.value.profiles.length <= 1) {
      setMessage('error', '至少保留一个 Profile')
      return false
    }
    const targetProfile = profiles.value.profiles.find((profile) => profile.id === profileId)
    if (!targetProfile) {
      setMessage('error', `Profile 不存在：${profileId}`)
      return false
    }

    const remainingProfiles = profiles.value.profiles.filter((profile) => profile.id !== profileId)
    const nextProfileId = settings.value.currentProfileId === profileId
      ? remainingProfiles[0]?.id || DEFAULT_PROFILE_ID
      : settings.value.currentProfileId
    const deleted = await withBusy(async () => {
      const nextProfiles = normalizeProfiles(
        {
          ...profiles.value,
          profiles: remainingProfiles,
        },
        currentTunnel.value.id,
      )
      profiles.value = normalizeProfiles(await api.saveProfiles(nextProfiles), currentTunnel.value.id)
      syncProfilesSnapshot()
      settings.value.currentProfileId = nextProfileId
      await persistSettings()
      await refreshStatus()
      return true
    }, 'Profile 已删除')

    return Boolean(deleted)
  }

  async function selectProfile(profileId: string) {
    if (status.value.running) {
      setMessage('error', '运行中不能切换 Profile，请先停止隧道')
      return
    }
    if (settings.value.currentProfileId === profileId) return
    await runAfterUnsavedProfilesConfirm(() => selectProfileNow(profileId))
  }

  async function selectProfileNow(profileId: string) {
    const previousProfileId = settings.value.currentProfileId
    loading.value = true
    clearMessage()
    try {
      settings.value.currentProfileId = profileId
      await persistSettings()
      await refreshStatus()
      setMessage('success', 'Profile 已切换')
    } catch (error) {
      settings.value.currentProfileId = previousProfileId
      setMessage('error', commandErrorMessage(error))
    } finally {
      loading.value = false
    }
  }

  function exportFileName(scope: 'current' | 'all') {
    const baseName = scope === 'current' ? currentProfile.value.id || 'profile' : 'profiles'
    return `tunneldesk-${baseName.replace(/[^a-zA-Z0-9_-]+/g, '-')}.json`
  }

  async function exportProfiles(profileIds: string[], scope: 'current' | 'all', okMessage: string) {
    const path = await save({
      title: '导出服务 Profile',
      defaultPath: exportFileName(scope),
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })
    if (!path) return
    await withBusy(() => api.exportProfiles(path, profileIds), okMessage)
  }

  async function exportCurrentProfile() {
    await exportProfiles([currentProfile.value.id], 'current', '当前 Profile 已导出')
  }

  async function exportAllProfiles() {
    await exportProfiles([], 'all', '全部 Profile 已导出')
  }

  async function previewProfilesImport(
    path?: string,
    tunnelMappings: TunnelMapping[] = [],
    quiet = false,
  ): Promise<ProfilesImportSession | undefined> {
    if (status.value.running) {
      setMessage('error', '运行中不能导入 Profile，请先停止隧道')
      return undefined
    }
    const selectedPath =
      path ||
      (await open({
        title: '导入服务 Profile',
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      }))
    if (!selectedPath || Array.isArray(selectedPath)) return undefined

    const action = async () => ({
      path: selectedPath,
      tunnelMappings,
      preview: await api.previewProfilesImport(selectedPath, tunnelMappings),
    })
    if (quiet) {
      loading.value = true
      clearMessage()
      try {
        return await action()
      } catch (error) {
        setMessage('error', commandErrorMessage(error))
        return undefined
      } finally {
        loading.value = false
      }
    }
    return withBusy(action, '导入预览已生成')
  }

  async function applyProfilesImport(
    path: string,
    tunnelMappings: TunnelMapping[],
  ): Promise<ProfilesImportApplyResult | undefined> {
    if (status.value.running) {
      setMessage('error', '运行中不能导入 Profile，请先停止隧道')
      return undefined
    }
    return withBusy(async () => {
      const result = await api.applyProfilesImport(path, tunnelMappings)
      applyConfig(result.settings, result.profiles)
      await refreshStatus()
      syncProfilesSnapshot()
      await refreshConfigBackups()
      return result
    }, 'Profile 已导入')
  }

  async function refreshConfigBackups() {
    configBackups.value = await api.listConfigBackups()
  }

  async function restoreConfigBackup(backupId: string): Promise<boolean> {
    const restored = await withBusy(async () => {
      const result = await api.restoreConfigBackup(backupId)
      applyConfig(result.settings, result.profiles)
      await refreshStatus()
      await refreshConfigBackups()
      return true
    }, '配置备份已恢复')
    return Boolean(restored)
  }

  async function deleteConfigBackup(backupId: string): Promise<boolean> {
    const deleted = await withBusy(async () => {
      await api.deleteConfigBackup(backupId)
      await refreshConfigBackups()
      return true
    }, '配置备份已删除')
    return Boolean(deleted)
  }

  async function runAfterUnsavedProfilesConfirm(action: () => Promise<void>) {
    if (!profilesDirty.value) {
      await action()
      return
    }
    pendingUnsavedProfilesAction.value = action
    unsavedProfilesConfirmOpen.value = true
  }

  function cancelUnsavedProfilesAction() {
    pendingUnsavedProfilesAction.value = null
    unsavedProfilesConfirmOpen.value = false
  }

  async function confirmUnsavedProfilesAction() {
    const action = pendingUnsavedProfilesAction.value
    cancelUnsavedProfilesAction()
    if (!action) return
    restoreProfilesSnapshot()
    await action()
  }

  async function start() {
    const issues = validateProfileStart(currentProfile.value, settings.value, status.value)
    if (issues.length) {
      startupValidationIssues.value = issues
      startupValidationOpen.value = true
      setMessage('error', '启动前检查失败')
      return
    }
    await withBusy(async () => {
      status.value = normalizeStatus(await api.startProfile())
    }, '隧道已启动')
  }

  function closeStartupValidation() {
    startupValidationOpen.value = false
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
    const group = normalizeServiceGroup(draft.group)
    const service: ServiceConfig = {
      ...draft,
      id: draft.id || slugify(draft.name),
      group,
      remark: draft.remark || '',
      port: Number(draft.port),
      tunnelId: draft.tunnelId || currentTunnel.value.id,
      sortOrder: Number(draft.sortOrder) > 0 ? Number(draft.sortOrder) : nextServiceSortOrder(group),
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

  function updateService(serviceId: string, draft: ServiceConfig): boolean {
    const index = currentProfile.value.services.findIndex((service) => service.id === serviceId)
    if (index === -1) {
      setMessage('error', `服务不存在：${serviceId}`)
      return false
    }

    const previous = currentProfile.value.services[index]
    const service: ServiceConfig = {
      ...previous,
      ...draft,
      id: previous.id,
      group: normalizeServiceGroup(draft.group),
      remark: draft.remark || '',
      port: Number(draft.port),
      tunnelId: draft.tunnelId || currentTunnel.value.id,
      sortOrder: Number(draft.sortOrder) > 0 ? Number(draft.sortOrder) : previous.sortOrder,
      enabled: draft.enabled ?? true,
    }
    if (!service.name || !service.domain || !service.localIp) {
      setMessage('error', '请填写服务名、域名和本地 IP')
      return false
    }
    const duplicate = findDuplicateListener(currentProfile.value.services, service)
    if (duplicate) {
      setMessage('error', `监听地址已被 ${duplicate.name} 使用`)
      return false
    }
    currentProfile.value.services[index] = service
    setMessage('info', '服务已更新，请保存后生效')
    return true
  }

  function removeService(serviceId: string) {
    currentProfile.value.services = currentProfile.value.services.filter((service) => service.id !== serviceId)
  }

  function nextServiceSortOrder(group: string) {
    const groupKey = normalizeServiceGroup(group)
    const maxOrder = currentProfile.value.services
      .filter((service) => normalizeServiceGroup(service.group) === groupKey)
      .reduce((max, service) => Math.max(max, Number(service.sortOrder) || 0), 0)
    return maxOrder + 10
  }

  function orderedGroupServices(group: string) {
    const groupKey = normalizeServiceGroup(group)
    return orderServices(currentProfile.value.services).filter((service) => normalizeServiceGroup(service.group) === groupKey)
  }

  function resequenceGroup(group: string) {
    orderedGroupServices(group).forEach((service, index) => {
      service.sortOrder = (index + 1) * 10
    })
  }

  function canMoveService(serviceId: string, direction: MoveDirection): boolean {
    const service = currentProfile.value.services.find((item) => item.id === serviceId)
    if (!service) return false
    const groupServices = orderedGroupServices(normalizeServiceGroup(service.group))
    const index = groupServices.findIndex((item) => item.id === serviceId)
    if (index === -1) return false
    return direction < 0 ? index > 0 : index < groupServices.length - 1
  }

  function moveService(serviceId: string, direction: MoveDirection) {
    const service = currentProfile.value.services.find((item) => item.id === serviceId)
    if (!service) return
    const group = normalizeServiceGroup(service.group)
    resequenceGroup(group)
    const groupServices = orderedGroupServices(group)
    const index = groupServices.findIndex((item) => item.id === serviceId)
    const target = groupServices[index + direction]
    if (!target) return
    const currentOrder = service.sortOrder
    service.sortOrder = target.sortOrder
    target.sortOrder = currentOrder
    setMessage('info', '服务顺序已调整，请保存后生效')
  }

  function canReorderService(serviceId: string, targetServiceId: string): boolean {
    if (serviceId === targetServiceId) return false
    const service = currentProfile.value.services.find((item) => item.id === serviceId)
    const target = currentProfile.value.services.find((item) => item.id === targetServiceId)
    if (!service || !target) return false
    return normalizeServiceGroup(service.group) === normalizeServiceGroup(target.group)
  }

  function reorderService(serviceId: string, targetServiceId: string, placement: DropPlacement = 'before'): boolean {
    if (!canReorderService(serviceId, targetServiceId)) return false
    const service = currentProfile.value.services.find((item) => item.id === serviceId)
    const target = currentProfile.value.services.find((item) => item.id === targetServiceId)
    if (!service || !target) return false

    const groupServices = orderedGroupServices(normalizeServiceGroup(service.group))
    const fromIndex = groupServices.findIndex((item) => item.id === serviceId)
    const targetIndex = groupServices.findIndex((item) => item.id === targetServiceId)
    if (fromIndex === -1 || targetIndex === -1) return false

    const [moved] = groupServices.splice(fromIndex, 1)
    const targetAfterRemovalIndex = groupServices.findIndex((item) => item.id === targetServiceId)
    const insertIndex = placement === 'after' ? targetAfterRemovalIndex + 1 : targetAfterRemovalIndex
    groupServices.splice(insertIndex, 0, moved)
    groupServices.forEach((item, index) => {
      item.sortOrder = (index + 1) * 10
    })
    setMessage('info', '服务顺序已调整，请保存后生效')
    return true
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
    unsavedProfilesConfirmOpen,
    startupValidationIssues,
    startupValidationOpen,
    configBackups,
    currentProfile,
    currentTunnel,
    activeServices,
    profileTunnelIds,
    orderedCurrentServices,
    serviceGroups,
    serviceGroupOptions,
    profilesDirty,
    setMessage,
    clearMessage,
    runAfterUnsavedProfilesConfirm,
    cancelUnsavedProfilesAction,
    confirmUnsavedProfilesAction,
    closeStartupValidation,
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
    createProfile,
    renameProfile,
    deleteProfile,
    selectProfile,
    exportCurrentProfile,
    exportAllProfiles,
    previewProfilesImport,
    applyProfilesImport,
    refreshConfigBackups,
    restoreConfigBackup,
    deleteConfigBackup,
    start,
    stop,
    repairHosts,
    openLogDir,
    selectTunnel,
    addTunnel,
    removeTunnel,
    addService,
    updateService,
    removeService,
    canMoveService,
    moveService,
    canReorderService,
    reorderService,
    nextServiceLocalIp,
    tunnelName,
    tunnelRunning,
  }
})

function normalizeServiceGroup(value?: string) {
  return value?.trim() || ''
}

function serviceGroupLabel(value?: string) {
  return normalizeServiceGroup(value) || '未分组'
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'zh-Hans-CN')
}

function cloneProfiles(value: ProfilesFile): ProfilesFile {
  return JSON.parse(JSON.stringify(value)) as ProfilesFile
}

function profilesSnapshot(value: ProfilesFile) {
  return JSON.stringify(value)
}

function serviceOrder(service: ServiceConfig) {
  const value = Number(service.sortOrder)
  return Number.isFinite(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER
}

function orderServices(services: ServiceConfig[]) {
  const originalIndex = new Map(services.map((service, index) => [service.id, index]))
  return [...services].sort((left, right) => {
    const groupCompare = compareText(serviceGroupLabel(left.group), serviceGroupLabel(right.group))
    if (groupCompare !== 0) return groupCompare

    const orderCompare = serviceOrder(left) - serviceOrder(right)
    if (orderCompare !== 0) return orderCompare

    return (originalIndex.get(left.id) ?? 0) - (originalIndex.get(right.id) ?? 0)
  })
}
