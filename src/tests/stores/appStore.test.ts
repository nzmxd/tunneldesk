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
  listConfigBackups: vi.fn(),
  restoreConfigBackup: vi.fn(),
  deleteConfigBackup: vi.fn(),
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
    mockApi.listConfigBackups.mockResolvedValue([])
    mockApi.restoreConfigBackup.mockResolvedValue({ settings: defaultSettings(), profiles: defaultProfiles() })
    mockApi.deleteConfigBackup.mockResolvedValue(undefined)
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
    mockApi.getStatus.mockResolvedValue({
      ...defaultStatus(),
      privilege: { ...defaultStatus().privilege, canModifyHosts: true },
    })

    await store.refresh()

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
      group: '',
      domain: 'mysql.internal',
      remark: '',
      port: 3306,
      localIp: '127.77.0.10',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: true,
    })

    expect(added).toBe(true)
    expect(store.currentProfile.services).toHaveLength(1)

    store.removeService('mysql')
    expect(store.currentProfile.services).toHaveLength(0)
  })

  it('updates an existing service without changing its id', () => {
    const store = useAppStore()

    store.addService({
      id: '',
      name: 'MySQL',
      group: '',
      domain: 'mysql.internal',
      remark: '',
      port: 3306,
      localIp: '127.77.0.10',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: true,
    })

    const updated = store.updateService('mysql', {
      id: 'ignored',
      name: 'Primary MySQL',
      group: 'Database',
      domain: 'primary-mysql.internal',
      remark: 'Primary database',
      port: 3307,
      localIp: '127.77.0.11',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: false,
    })

    expect(updated).toBe(true)
    expect(store.currentProfile.services[0]).toEqual(expect.objectContaining({
      id: 'mysql',
      name: 'Primary MySQL',
      group: 'Database',
      domain: 'primary-mysql.internal',
      remark: 'Primary database',
      port: 3307,
      localIp: '127.77.0.11',
      enabled: false,
    }))
  })

  it('tracks unsaved profile changes and clears the flag after saving', async () => {
    const store = useAppStore()

    await store.refresh()
    expect(store.profilesDirty).toBe(false)

    store.addService({
      id: '',
      name: 'MySQL',
      group: '',
      domain: 'mysql.internal',
      remark: '',
      port: 3306,
      localIp: '127.77.0.10',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: true,
    })

    expect(store.profilesDirty).toBe(true)
    await store.saveProfiles()
    expect(store.profilesDirty).toBe(false)
  })

  it('groups services and moves order within a group', async () => {
    const store = useAppStore()

    store.addService({
      id: '',
      name: 'MySQL',
      group: 'Database',
      domain: 'mysql.internal',
      remark: '',
      port: 3306,
      localIp: '127.77.0.10',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: true,
    })
    store.addService({
      id: '',
      name: 'Postgres',
      group: 'Database',
      domain: 'postgres.internal',
      remark: '',
      port: 5432,
      localIp: '127.77.0.11',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: true,
    })

    expect(store.serviceGroups[0].label).toBe('Database')
    expect(store.serviceGroups[0].services.map((service) => service.id)).toEqual(['mysql', 'postgres'])

    store.moveService('postgres', -1)

    expect(store.serviceGroups[0].services.map((service) => service.id)).toEqual(['postgres', 'mysql'])
    await store.saveProfiles()

    expect(mockApi.saveProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        profiles: [
          expect.objectContaining({
            services: [
              expect.objectContaining({ id: 'postgres', group: 'Database', sortOrder: 10 }),
              expect.objectContaining({ id: 'mysql', group: 'Database', sortOrder: 20 }),
            ],
          }),
        ],
      }),
    )
  })

  it('reorders services by dragging within the same group', () => {
    const store = useAppStore()

    store.addService({
      id: '',
      name: 'MySQL',
      group: 'Database',
      domain: 'mysql.internal',
      remark: '',
      port: 3306,
      localIp: '127.77.0.10',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: true,
    })
    store.addService({
      id: '',
      name: 'Postgres',
      group: 'Database',
      domain: 'postgres.internal',
      remark: '',
      port: 5432,
      localIp: '127.77.0.11',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: true,
    })
    store.addService({
      id: '',
      name: 'Redis',
      group: 'Cache',
      domain: 'redis.internal',
      remark: '',
      port: 6379,
      localIp: '127.77.0.12',
      tunnelId: 'default',
      sortOrder: 0,
      enabled: true,
    })

    expect(store.reorderService('postgres', 'mysql', 'before')).toBe(true)
    expect(store.serviceGroups.find((group) => group.label === 'Database')?.services.map((service) => service.id)).toEqual(['postgres', 'mysql'])
    expect(store.reorderService('mysql', 'redis', 'before')).toBe(false)
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
          oldGroup: '',
          oldDomain: 'mysql.old',
          oldPort: 3306,
          oldLocalIp: '127.77.0.10',
          oldTunnelId: 'default',
          oldSortOrder: 10,
          newName: 'MySQL',
          newGroup: 'Database',
          newDomain: 'mysql.new',
          newPort: 3306,
          newLocalIp: '127.77.0.10',
          newTunnelId: 'default',
          newSortOrder: 20,
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
    expect(mockApi.listConfigBackups).toHaveBeenCalled()
  })

  it('restores and deletes config backups', async () => {
    const store = useAppStore()
    const restoredProfiles = {
      schemaVersion: 2,
      profiles: [{ id: 'restored', name: 'Restored Profile', enabled: true, services: [] }],
    }
    mockApi.listConfigBackups.mockResolvedValue([{ id: 'backup-1', fileName: 'backup-1.json', createdAt: '2026-07-04T00:00:00+08:00' }])
    mockApi.restoreConfigBackup.mockResolvedValue({
      settings: { ...defaultSettings(), currentProfileId: 'restored' },
      profiles: restoredProfiles,
    })

    await store.refreshConfigBackups()
    const restored = await store.restoreConfigBackup('backup-1')
    const deleted = await store.deleteConfigBackup('backup-1')

    expect(store.configBackups).toHaveLength(1)
    expect(restored).toBe(true)
    expect(deleted).toBe(true)
    expect(store.settings.currentProfileId).toBe('restored')
    expect(store.profiles.profiles[0].id).toBe('restored')
    expect(mockApi.deleteConfigBackup).toHaveBeenCalledWith('backup-1')
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
