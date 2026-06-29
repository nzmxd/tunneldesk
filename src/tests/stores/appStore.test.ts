import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defaultProfiles, defaultSettings, defaultStatus } from '@/shared/domain/defaults'
import { useAppStore } from '@/stores/appStore'

const mockApi = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  setLaunchAtLogin: vi.fn(),
  loadProfiles: vi.fn(),
  saveProfiles: vi.fn(),
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

vi.mock('@/shared/api/tauri', () => ({
  api: mockApi,
}))

describe('appStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockApi.loadSettings.mockResolvedValue(defaultSettings())
    mockApi.saveSettings.mockImplementation(async (settings) => settings)
    mockApi.setLaunchAtLogin.mockResolvedValue(true)
    mockApi.loadProfiles.mockResolvedValue(defaultProfiles())
    mockApi.saveProfiles.mockImplementation(async (profiles) => profiles)
    mockApi.hasTunnelPassword.mockResolvedValue(false)
    mockApi.saveTunnelPassword.mockResolvedValue(undefined)
    mockApi.deleteTunnelPassword.mockResolvedValue(undefined)
    mockApi.testSsh.mockResolvedValue(undefined)
    mockApi.startProfile.mockResolvedValue({ ...defaultStatus(), running: true, runningTunnelIds: ['default'] })
    mockApi.stopProfile.mockResolvedValue({ ...defaultStatus(), running: false })
    mockApi.getStatus.mockResolvedValue(defaultStatus())
    mockApi.repairHosts.mockResolvedValue(undefined)
    mockApi.openLogDir.mockResolvedValue(undefined)
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
})
