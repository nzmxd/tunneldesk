import type { ThemeMode, TunnelConfig } from './tunnel'

export interface BehaviorSettings {
  startMinimized: boolean
  autoStartProfile: boolean
  launchAtLogin: boolean
  autoRepairOnStart: boolean
  cleanupOnExit: boolean
  themeMode: ThemeMode
}

export interface AppSettings {
  schemaVersion: number
  currentProfileId: string
  currentTunnelId: string
  tunnels: TunnelConfig[]
  behavior: BehaviorSettings
}
