import type { ServiceState, ServiceStatus } from '@/shared/types'

export function runningLabel(running: boolean): string {
  return running ? '运行中' : '已停止'
}

export function serviceStatusFor(serviceId: string, statuses: ServiceStatus[]): ServiceStatus | undefined {
  return statuses.find((item) => item.serviceId === serviceId)
}

export function serviceStateText(state?: ServiceState): string {
  if (state === 'healthy') return '正常'
  if (state === 'disabled') return '禁用'
  if (state === 'stopped') return '未监听'
  if (state === 'checking') return '检查中'
  if (state === 'error') return '异常'
  return '未知'
}

export function serviceStateColor(state?: ServiceState): string {
  if (state === 'healthy') return 'success'
  if (state === 'checking') return 'processing'
  if (state === 'error') return 'error'
  if (state === 'disabled') return 'default'
  return 'warning'
}
