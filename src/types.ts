export type AuthMethod = 'password' | 'privateKey' | 'agent'

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
  autoRepairOnStart: boolean
  cleanupOnExit: boolean
}

export interface AppSettings {
  schemaVersion: number
  currentProfileId: string
  ssh: SshSettings
  behavior: BehaviorSettings
}

export interface ServiceConfig {
  id: string
  name: string
  domain: string
  port: number
  localIp: string
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

export interface AppStatus {
  running: boolean
  currentProfileId: string
  isAdmin: boolean
  hostsBlockPresent: boolean
  message: string
  services: ServiceStatus[]
}

export interface SecretPayload {
  key: string
  value: string
}
