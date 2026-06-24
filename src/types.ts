export type AuthMethod = 'password' | 'privateKey' | 'agent'
export type ThemeMode = 'system' | 'light' | 'dark'

export interface SshSettings {
  host: string
  port: number
  username: string
  authMethod: AuthMethod
  identityFile: string
  passwordCredentialKey: string
  keyPassphraseCredentialKey: string
  serverAliveInterval: number
  serverAliveCountMax: number
}

export interface BehaviorSettings {
  startMinimized: boolean
  autoStartProfile: boolean
  launchAtLogin: boolean
  autoRepairOnStart: boolean
  cleanupOnExit: boolean
  themeMode: ThemeMode
}

export interface TunnelConfig {
  id: string
  name: string
  enabled: boolean
  ssh: SshSettings
}

export interface AppSettings {
  schemaVersion: number
  currentProfileId: string
  currentTunnelId: string
  tunnels: TunnelConfig[]
  behavior: BehaviorSettings
}

export interface ServiceConfig {
  id: string
  name: string
  domain: string
  port: number
  localIp: string
  tunnelId: string
  enabled: boolean
}

export interface ServiceProfile {
  id: string
  name: string
  enabled: boolean
  services: ServiceConfig[]
}

export interface ProfilesFile {
  schemaVersion: number
  profiles: ServiceProfile[]
}

export type ServiceState = 'disabled' | 'stopped' | 'checking' | 'healthy' | 'error'

export interface ServiceStatus {
  serviceId: string
  state: ServiceState
  message: string
}

export interface TunnelStatus {
  tunnelId: string
  name: string
  running: boolean
  message: string
}

export interface AppStatus {
  running: boolean
  currentProfileId: string
  runningTunnelIds: string[]
  tunnels: TunnelStatus[]
  isAdmin: boolean
  hostsBlockPresent: boolean
  message: string
  services: ServiceStatus[]
}
