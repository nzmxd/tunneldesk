import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defaultProfiles, defaultSettings, defaultStatus } from '@/shared/domain/defaults'
import { useAppStore } from '@/stores/appStore'

const mockApi = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  launchAtLoginEnabled: vi.fn(),
  setLaunchAtLogin: vi.fn(),
  loadProfiles: vi.fn(),
  saveProfiles: vi.fn(),
  exportProfiles: vi.fn(),
  previewProfilesImport: vi.fn(),
  applyProfilesImport: vi.fn(),
  saveTunnelPassword: vi.fn(),
  deleteTunnelPassword: vi.fn(),
  hasTunnelPassword: vi.fn(),
  testSsh: vi.fn(),
  startProfile: vi.fn(),
  stopProfile: vi.fn(),
  getStatus: vi.fn(),
  testService: vi.fn(),
  repairHosts: vi.fn(),
  openLogDir: vi.fn(),
}))

const mockDialog = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@/shared/api/tauri', () => ({
  api: mockApi,
}))

vi.mock('@tauri-apps/plugin-dialog', () => mockDialog)

describe('appStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockApi.loadSettings.mockResolvedValue(defaultSettings())
    mockApi.saveSettings.mockImplementation(async (settings) => settings)
    mockApi.launchAtLoginEnabled.mockResolvedValue(false)
    mockApi.setLaunchAtLogin.mockResolvedValue(true)
    mockApi.loadProfiles.mockResolvedValue(defaultProfiles())
    mockApi.saveProfiles.mockImplementation(async (profiles) => profiles)
    mockApi.exportProfiles.mockResolvedValue(undefined)
    mockApi.previewProfilesImport.mockResolvedValue(emptyImportPreview())
    mockApi.applyProfilesImport.mockResolvedValue({
      settings: defaultSettings(),
      profiles: defaultProfiles(),
      preview: emptyImportPreview(),
      backupPath: '',
    })
    mockApi.hasTunnelPassword.mockResolvedValue(false)
    mockApi.saveTunnelPassword.mockResolvedValue(undefined)
    mockApi.deleteTunnelPassword.mockResolvedValue(undefined)
    mockApi.testSsh.mockResolvedValue(undefined)
    mockApi.startProfile.mockResolvedValue({ ...defaultStatus(), running: true, runningTunnelIds: ['default'] })
    mockApi.stopProfile.mockResolvedValue({ ...defaultStatus(), running: false })
    mockApi.getStatus.mockResolvedValue(defaultStatus())
    mockApi.repairHosts.mockResolvedValue(undefined)
    mockApi.openLogDir.mockResolvedValue(undefined)
    mockDialog.open.mockResolvedValue('profiles.json')
    mockDialog.save.mockResolvedValue('profiles-export.json')
  })

  it('loads settings, profiles, status, and password state', async () => {
    const store = useAppStore()

    await store.refresh()

    expect(store.initialized).toBe(true)
    expect(store.currentTunnel.id).toBe('default')
    expect(mockApi.hasTunnelPassword).toHaveBeenCalledWith('default')
  })

  it('bootstraps config before background status completes', async () => {
    let resolveStatus: (value: unknown) => void = () => {}
    const statusPromise = new Promise((resolve) => {
      resolveStatus = resolve
    })
    mockApi.getStatus.mockReturnValue(statusPromise)
    const store = useAppStore()

    await store.bootstrap()

    expect(store.initialized).toBe(true)
    expect(mockApi.loadSettings).toHaveBeenCalled()
    expect(mockApi.loadProfiles).toHaveBeenCalled()
    expect(mockApi.getStatus).toHaveBeenCalled()
    expect(store.status.running).toBe(false)

    resolveStatus({ ...defaultStatus(), running: true, runningTunnelIds: ['default'] })
    await statusPromise
    await Promise.resolve()

    expect(store.status.running).toBe(true)
    expect(store.status.runningTunnelIds).toEqual(['default'])
  })

  it('reload waits for status and updates the store', async () => {
    mockApi.getStatus.mockResolvedValue({ ...defaultStatus(), running: true, runningTunnelIds: ['default'] })
    const store = useAppStore()

    await store.reload()

    expect(store.status.running).toBe(true)
    expect(store.status.runningTunnelIds).toEqual(['default'])
    expect(store.message).toBe('状态已刷新')
  })

  it('starts and stops the active profile', async () => {
    const store = useAppStore()

    await store.start()
    expect(store.status.running).toBe(true)
    expect(store.status.runningTunnelIds).toEqual(['default'])

    await store.stop()
    expect(store.status.running).toBe(false)
  })

  it('saves tunnel passwords without exposing saved values', async () => {
    const store = useAppStore()

    await store.refresh()
    await store.saveTunnel('secret')

    expect(mockApi.saveSettings).toHaveBeenCalled()
    expect(mockApi.saveTunnelPassword).toHaveBeenCalledWith('default', 'secret')
  })

  it('adds and removes services in the default profile', () => {
    const store = useAppStore()

    const added = store.addService({
      id: '',
      name: 'MySQL',
      domain: 'mysql.internal',
      port: 3306,
      localIp: '127.77.0.10',
      tunnelId: 'default',
      enabled: true,
    })

    expect(added).toBe(true)
    expect(store.currentProfile.services).toHaveLength(1)

    store.removeService('mysql')
    expect(store.currentProfile.services).toHaveLength(0)
  })

  it('switches profiles by saving current profile selection', async () => {
    const store = useAppStore()
    mockApi.loadProfiles.mockResolvedValue({
      schemaVersion: 2,
      profiles: [
        { id: 'default', name: 'Default Profile', enabled: true, services: [] },
        { id: 'team', name: 'Team Profile', enabled: true, services: [] },
      ],
    })

    await store.refresh()
    await store.selectProfile('team')

    expect(store.settings.currentProfileId).toBe('team')
    expect(mockApi.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ currentProfileId: 'team' }))
  })

  it('creates a profile and switches to it', async () => {
    const store = useAppStore()

    const created = await store.createProfile('Team Profile')

    expect(created).toBe(true)
    expect(store.settings.currentProfileId).toBe('team-profile')
    expect(store.currentProfile.name).toBe('Team Profile')
    expect(mockApi.saveProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        profiles: expect.arrayContaining([expect.objectContaining({ id: 'team-profile', name: 'Team Profile' })]),
      }),
    )
    expect(mockApi.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ currentProfileId: 'team-profile' }))
  })

  it('renames a profile', async () => {
    const store = useAppStore()

    const renamed = await store.renameProfile('default', 'Renamed Profile')

    expect(renamed).toBe(true)
    expect(store.currentProfile.name).toBe('Renamed Profile')
    expect(mockApi.saveProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        profiles: expect.arrayContaining([expect.objectContaining({ id: 'default', name: 'Renamed Profile' })]),
      }),
    )
    expect(mockApi.saveSettings).not.toHaveBeenCalled()
  })

  it('prevents duplicate profile names when renaming', async () => {
    const store = useAppStore()
    mockApi.loadProfiles.mockResolvedValue({
      schemaVersion: 2,
      profiles: [
        { id: 'default', name: 'Default Profile', enabled: true, services: [] },
        { id: 'team', name: 'Team Profile', enabled: true, services: [] },
      ],
    })

    await store.refresh()
    mockApi.saveProfiles.mockClear()
    const renamed = await store.renameProfile('team', 'Default Profile')

    expect(renamed).toBe(false)
    expect(mockApi.saveProfiles).not.toHaveBeenCalled()
    expect(store.message).toContain('Profile 已存在')
  })

  it('deletes the current profile and switches to a remaining one', async () => {
    const store = useAppStore()
    mockApi.loadSettings.mockResolvedValue({ ...defaultSettings(), currentProfileId: 'team' })
    mockApi.loadProfiles.mockResolvedValue({
      schemaVersion: 2,
      profiles: [
        { id: 'default', name: 'Default Profile', enabled: true, services: [] },
        { id: 'team', name: 'Team Profile', enabled: true, services: [] },
      ],
    })

    await store.refresh()
    const deleted = await store.deleteProfile('team')

    expect(deleted).toBe(true)
    expect(store.settings.currentProfileId).toBe('default')
    expect(store.profiles.profiles).toHaveLength(1)
    expect(mockApi.saveProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        profiles: [expect.objectContaining({ id: 'default' })],
      }),
    )
    expect(mockApi.saveSettings).toHaveBeenLastCalledWith(expect.objectContaining({ currentProfileId: 'default' }))
  })

  it('keeps at least one profile when deleting', async () => {
    const store = useAppStore()

    await store.refresh()
    const deleted = await store.deleteProfile('default')

    expect(deleted).toBe(false)
    expect(mockApi.saveProfiles).not.toHaveBeenCalled()
    expect(store.message).toContain('至少保留一个 Profile')
  })

  it('blocks profile switching and imports while running', async () => {
    const store = useAppStore()
    mockApi.getStatus.mockResolvedValue({ ...defaultStatus(), running: true, runningTunnelIds: ['default'] })

    await store.refresh()
    await store.selectProfile('team')
    const renamed = await store.renameProfile('default', 'Renamed Profile')
    const session = await store.previewProfilesImport()

    expect(renamed).toBe(false)
    expect(session).toBeUndefined()
    expect(mockApi.saveSettings).not.toHaveBeenCalled()
    expect(mockApi.saveProfiles).not.toHaveBeenCalled()
    expect(mockApi.previewProfilesImport).not.toHaveBeenCalled()
    expect(store.message).toContain('运行中不能导入')
  })

  it('previews and applies profile imports', async () => {
    const store = useAppStore()
    const importedProfiles = {
      schemaVersion: 2,
      profiles: [{ id: 'team', name: 'Team Profile', enabled: true, services: [] }],
    }
    const importedSettings = { ...defaultSettings(), currentProfileId: 'team' }
    mockApi.previewProfilesImport.mockResolvedValue({
      ...emptyImportPreview(),
      profileCount: 1,
      importedProfileIds: ['team'],
      overwrites: [
        {
          profileId: 'default',
          profileName: 'Default Profile',
          serviceId: 'mysql',
          oldName: 'MySQL',
          oldDomain: 'mysql.old',
          oldPort: 3306,
          oldLocalIp: '127.77.0.10',
          oldTunnelId: 'default',
          newName: 'MySQL',
          newDomain: 'mysql.new',
          newPort: 3306,
          newLocalIp: '127.77.0.10',
          newTunnelId: 'default',
        },
      ],
    })
    mockApi.applyProfilesImport.mockResolvedValue({
      settings: importedSettings,
      profiles: importedProfiles,
      preview: emptyImportPreview(),
      backupPath: 'profiles-backup.json',
    })

    const session = await store.previewProfilesImport()
    const result = await store.applyProfilesImport('profiles.json', [])

    expect(session?.preview.profileCount).toBe(1)
    expect(mockApi.previewProfilesImport).toHaveBeenCalledWith('profiles.json', [])
    expect(result?.backupPath).toBe('profiles-backup.json')
    expect(store.settings.currentProfileId).toBe('team')
    expect(store.profiles.profiles[0].id).toBe('team')
  })
})

function emptyImportPreview() {
  return {
    profileCount: 0,
    serviceCount: 0,
    addedProfileCount: 0,
    addedServiceCount: 0,
    updatedServiceCount: 0,
    skippedServiceCount: 0,
    importedProfileIds: [],
    missingTunnels: [],
    overwrites: [],
    conflicts: [],
    canApply: true,
  }
}
