import { invoke } from '@tauri-apps/api/core'
import type { AppSettings, AppStatus, ProfilesFile, ServiceStatus } from '@/shared/types'

export const api = {
  loadSettings: () => invoke<AppSettings>('load_settings'),
  saveSettings: (settings: AppSettings) => invoke<AppSettings>('save_settings', { settings }),
  setLaunchAtLogin: (enabled: boolean) => invoke<boolean>('set_launch_at_login', { enabled }),
  loadProfiles: () => invoke<ProfilesFile>('load_profiles'),
  saveProfiles: (profiles: ProfilesFile) => invoke<ProfilesFile>('save_profiles', { profiles }),
  saveTunnelPassword: (tunnelId: string, value: string) =>
    invoke<void>('save_tunnel_password', { tunnelId, value }),
  deleteTunnelPassword: (tunnelId: string) => invoke<void>('delete_tunnel_password', { tunnelId }),
  hasTunnelPassword: (tunnelId: string) => invoke<boolean>('has_tunnel_password', { tunnelId }),
  testSsh: (tunnelId: string) => invoke<void>('test_ssh', { tunnelId }),
  startProfile: () => invoke<AppStatus>('start_profile'),
  stopProfile: () => invoke<AppStatus>('stop_profile'),
  getStatus: () => invoke<AppStatus>('get_status'),
  testService: (serviceId: string) => invoke<ServiceStatus>('test_service', { serviceId }),
  repairHosts: () => invoke<void>('repair_hosts'),
  openLogDir: () => invoke<void>('open_log_dir'),
}
