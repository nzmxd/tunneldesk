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
