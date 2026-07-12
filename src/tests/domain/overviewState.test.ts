import { describe, expect, it } from 'vitest'
import { buildOverviewSummary } from '@/features/overview/overviewState'
import { defaultProfiles, defaultServiceDraft, defaultSettings, defaultStatus } from '@/shared/domain/defaults'

function readyFixture() {
  const settings = defaultSettings()
  settings.tunnels[0].ssh.host = 'ssh.example.com'
  settings.tunnels[0].ssh.username = 'tunnel'
  const profile = defaultProfiles().profiles[0]
  profile.services.push({
    ...defaultServiceDraft(),
    id: 'mysql',
    name: 'MySQL',
    domain: 'mysql.local',
    port: 3306,
  })
  const status = defaultStatus()
  status.privilege = {
    ...status.privilege,
    process: 'root',
    hostsAccess: 'direct',
    canModifyHosts: true,
    message: 'Hosts can be modified directly',
  }
  return { settings, profile, status }
}

describe('overview state', () => {
  it('reports incomplete configuration when no services exist', () => {
    const settings = defaultSettings()
    const profile = defaultProfiles().profiles[0]
    const status = defaultStatus()

    const summary = buildOverviewSummary(profile, settings, status)

    expect(summary.title).toBe('配置待完善')
    expect(summary.enabledServices).toBe(0)
  })

  it('reports ready when startup validation passes', () => {
    const { settings, profile, status } = readyFixture()

    const summary = buildOverviewSummary(profile, settings, status)

    expect(summary.title).toBe('准备就绪')
    expect(summary.stages.map((stage) => stage.detail)).toEqual(['1 项已配置', '1 条待启动', '可写入'])
  })

  it('reports a healthy running profile and counts metrics', () => {
    const { settings, profile, status } = readyFixture()
    status.running = true
    status.runningTunnelIds = ['default']
    status.hostsBlockPresent = true
    status.services = [{ serviceId: 'mysql', state: 'healthy', message: 'reachable' }]

    const summary = buildOverviewSummary(profile, settings, status)

    expect(summary.title).toBe('运行正常')
    expect(summary).toMatchObject({ enabledServices: 1, runningTunnels: 1, healthyServices: 1, abnormalServices: 0 })
  })

  it('reports abnormal running services without adding latency data', () => {
    const { settings, profile, status } = readyFixture()
    status.running = true
    status.runningTunnelIds = ['default']
    status.hostsBlockPresent = true
    status.services = [{ serviceId: 'mysql', state: 'error', message: 'connection refused' }]

    const summary = buildOverviewSummary(profile, settings, status)

    expect(summary.title).toBe('需要处理')
    expect(summary.abnormalServices).toBe(1)
  })
})
