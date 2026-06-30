import { invoke } from '@tauri-apps/api/core'
import { defaultProfiles, defaultSettings, defaultStatus } from '@/shared/domain/defaults'
import type { AppSettings, AppStatus, ProfilesFile, ServiceStatus } from '@/shared/types'

type InvokeArgs = Record<string, unknown>

function hasTauriInvoke() {
  const tauriWindow = window as typeof window & { __TAURI_INTERNALS__?: { invoke?: unknown } }
  return typeof tauriWindow.__TAURI_INTERNALS__?.invoke === 'function'
}

async function invokeCommand<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  if (hasTauriInvoke()) {
    return invoke<T>(cmd, args)
  }
  if (import.meta.env.DEV) {
    return devInvoke<T>(cmd, args)
  }
  throw new Error('Tauri API is unavailable')
}

async function devInvoke<T>(cmd: string, args?: InvokeArgs): Promise<T> {
  switch (cmd) {
    case 'load_settings':
      return defaultSettings() as T
    case 'save_settings':
      return (args?.settings || defaultSettings()) as T
    case 'load_profiles':
      return defaultProfiles() as T
    case 'save_profiles':
      return (args?.profiles || defaultProfiles()) as T
    case 'get_status':
    case 'start_profile':
      return defaultStatus() as T
    case 'stop_profile':
      return { ...defaultStatus(), running: false } as T
    case 'launch_at_login_enabled':
    case 'set_launch_at_login':
    case 'has_tunnel_password':
      return false as T
    case 'test_service':
      return { serviceId: String(args?.serviceId || ''), state: 'stopped', message: 'Preview mode' } as T
    default:
      return undefined as T
  }
}

export const api = {
  loadSettings: () => invokeCommand<AppSettings>('load_settings'),
  launchAtLoginEnabled: () => invokeCommand<boolean>('launch_at_login_enabled'),
  saveSettings: (settings: AppSettings) => invokeCommand<AppSettings>('save_settings', { settings }),
  setLaunchAtLogin: (enabled: boolean) => invokeCommand<boolean>('set_launch_at_login', { enabled }),
  loadProfiles: () => invokeCommand<ProfilesFile>('load_profiles'),
  saveProfiles: (profiles: ProfilesFile) => invokeCommand<ProfilesFile>('save_profiles', { profiles }),
  saveTunnelPassword: (tunnelId: string, value: string) =>
    invokeCommand<void>('save_tunnel_password', { tunnelId, value }),
  deleteTunnelPassword: (tunnelId: string) => invokeCommand<void>('delete_tunnel_password', { tunnelId }),
  hasTunnelPassword: (tunnelId: string) => invokeCommand<boolean>('has_tunnel_password', { tunnelId }),
  testSsh: (tunnelId: string) => invokeCommand<void>('test_ssh', { tunnelId }),
  startProfile: () => invokeCommand<AppStatus>('start_profile'),
  stopProfile: () => invokeCommand<AppStatus>('stop_profile'),
  getStatus: () => invokeCommand<AppStatus>('get_status'),
  testService: (serviceId: string) => invokeCommand<ServiceStatus>('test_service', { serviceId }),
  repairHosts: () => invokeCommand<void>('repair_hosts'),
  openLogDir: () => invokeCommand<void>('open_log_dir'),
}
