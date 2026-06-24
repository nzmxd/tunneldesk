import { invoke } from '@tauri-apps/api/core'
import type { AppSettings, AppStatus, ProfilesFile, SecretPayload, ServiceStatus } from './types'

export const api = {
  loadSettings: () => invoke<AppSettings>('load_settings'),
  saveSettings: (settings: AppSettings) => invoke<AppSettings>('save_settings', { settings }),
  loadProfiles: () => invoke<ProfilesFile>('load_profiles'),
  saveProfiles: (profiles: ProfilesFile) => invoke<ProfilesFile>('save_profiles', { profiles }),
  saveSecret: (payload: SecretPayload) => invoke<void>('save_secret', { payload }),
  deleteSecret: (key: string) => invoke<void>('delete_secret', { key }),
  hasSecret: (key: string) => invoke<boolean>('has_secret', { key }),
  testSsh: (settings: AppSettings) => invoke<void>('test_ssh', { settings }),
  startProfile: () => invoke<AppStatus>('start_profile'),
  stopProfile: () => invoke<AppStatus>('stop_profile'),
  getStatus: () => invoke<AppStatus>('get_status'),
  testService: (serviceId: string) => invoke<ServiceStatus>('test_service', { serviceId }),
  repairHosts: () => invoke<void>('repair_hosts'),
  openLogDir: () => invoke<void>('open_log_dir'),
}
