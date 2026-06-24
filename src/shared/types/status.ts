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
