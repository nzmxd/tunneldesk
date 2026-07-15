import type { AppSettings, AppStatus, ServiceProfile } from '@/shared/types'
import { validateProfileStart } from '@/shared/domain/startupValidation'

export type OverviewTone = 'success' | 'warning' | 'danger' | 'neutral'

export interface OverviewStage {
  key: 'services' | 'tunnels' | 'hosts'
  label: string
  detail: string
  tone: OverviewTone
}

export interface OverviewSummary {
  title: '准备就绪' | '运行正常' | '需要处理' | '配置待完善'
  description: string
  tone: OverviewTone
  stages: OverviewStage[]
  enabledServices: number
  runningTunnels: number
  healthyServices: number
  abnormalServices: number
}

export function buildOverviewSummary(
  profile: ServiceProfile,
  settings: AppSettings,
  status: AppStatus,
): OverviewSummary {
  const enabledServices = profile.services.filter((service) => service.enabled)
  const statusesByServiceId = new Map(status.services.map((service) => [service.serviceId, service]))
  const healthyServices = enabledServices.filter(
    (service) => statusesByServiceId.get(service.id)?.state === 'healthy',
  ).length
  const abnormalServices = status.running
    ? enabledServices.length - healthyServices
    : 0
  const usedTunnelIds = new Set(enabledServices.map((service) => service.tunnelId).filter(Boolean))
  const configuredTunnels = settings.tunnels.filter((tunnel) => usedTunnelIds.has(tunnel.id))
  const tunnelConfigReady =
    usedTunnelIds.size > 0 &&
    configuredTunnels.length === usedTunnelIds.size &&
    configuredTunnels.every((tunnel) => tunnel.enabled && tunnel.ssh.host.trim() && tunnel.ssh.username.trim())
  const requiredTunnelsRunning =
    usedTunnelIds.size > 0 && Array.from(usedTunnelIds).every((id) => status.runningTunnelIds.includes(id))
  const validationIssues = validateProfileStart(profile, settings, status)
  const configurationReady = enabledServices.length > 0 && tunnelConfigReady && validationIssues.length === 0

  let title: OverviewSummary['title']
  let description: string
  let tone: OverviewTone

  if (status.running) {
    const healthy = abnormalServices === 0 && requiredTunnelsRunning && status.hostsBlockPresent
    title = healthy ? '运行正常' : '需要处理'
    description = healthy ? '当前 Profile 的服务与隧道均正常' : '检测到异常，请查看诊断结果'
    tone = healthy ? 'success' : 'danger'
  } else if (configurationReady) {
    title = '准备就绪'
    description = '所有启动前配置检查已通过'
    tone = 'success'
  } else {
    title = '配置待完善'
    description = enabledServices.length ? `${Math.max(validationIssues.length, 1)} 项配置需要处理` : '添加服务并配置隧道后即可启动'
    tone = 'warning'
  }

  const stages: OverviewStage[] = [
    serviceStage(status.running, enabledServices.length, healthyServices, abnormalServices),
    tunnelStage(status.running, usedTunnelIds.size, tunnelConfigReady, requiredTunnelsRunning),
    hostsStage(status.running, status.privilege.canModifyHosts, status.hostsBlockPresent),
  ]

  return {
    title,
    description,
    tone,
    stages,
    enabledServices: enabledServices.length,
    runningTunnels: status.runningTunnelIds.length,
    healthyServices,
    abnormalServices,
  }
}

function serviceStage(running: boolean, enabled: number, healthy: number, abnormal: number): OverviewStage {
  if (!enabled) return { key: 'services', label: '本地服务', detail: '未配置', tone: 'warning' }
  if (!running) return { key: 'services', label: '本地服务', detail: `${enabled} 项已配置`, tone: 'neutral' }
  if (abnormal) return { key: 'services', label: '本地服务', detail: `${abnormal} 项异常`, tone: 'danger' }
  return { key: 'services', label: '本地服务', detail: `${healthy} 项正常`, tone: 'success' }
}

function tunnelStage(running: boolean, used: number, configured: boolean, active: boolean): OverviewStage {
  if (!used) return { key: 'tunnels', label: 'SSH 隧道', detail: '未关联', tone: 'warning' }
  if (!configured) return { key: 'tunnels', label: 'SSH 隧道', detail: '配置不完整', tone: 'warning' }
  if (!running) return { key: 'tunnels', label: 'SSH 隧道', detail: `${used} 条待启动`, tone: 'neutral' }
  return active
    ? { key: 'tunnels', label: 'SSH 隧道', detail: `${used} 条运行中`, tone: 'success' }
    : { key: 'tunnels', label: 'SSH 隧道', detail: '连接异常', tone: 'danger' }
}

function hostsStage(running: boolean, writable: boolean, present: boolean): OverviewStage {
  if (!writable) return { key: 'hosts', label: 'hosts', detail: '权限不可用', tone: 'danger' }
  if (!running) return { key: 'hosts', label: 'hosts', detail: '可写入', tone: 'neutral' }
  return present
    ? { key: 'hosts', label: 'hosts', detail: '已写入', tone: 'success' }
    : { key: 'hosts', label: 'hosts', detail: '未写入', tone: 'danger' }
}
