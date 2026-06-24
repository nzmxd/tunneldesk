import type { RouteRecordRaw } from 'vue-router'
import AppShell from '@/layouts/AppShell.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppShell,
    redirect: '/overview',
    children: [
      { path: 'overview', name: 'overview', component: () => import('@/features/overview/OverviewPage.vue'), meta: { title: '总览' } },
      { path: 'tunnels', name: 'tunnels', component: () => import('@/features/tunnels/TunnelsPage.vue'), meta: { title: '隧道' } },
      { path: 'services', name: 'services', component: () => import('@/features/services/ServicesPage.vue'), meta: { title: '服务' } },
      { path: 'settings', name: 'settings', component: () => import('@/features/settings/SettingsPage.vue'), meta: { title: '设置' } },
      {
        path: 'diagnostics',
        name: 'diagnostics',
        component: () => import('@/features/diagnostics/DiagnosticsPage.vue'),
        meta: { title: '诊断' },
      },
      { path: 'logs', name: 'logs', component: () => import('@/features/logs/LogsPage.vue'), meta: { title: '日志' } },
    ],
  },
]
