import { computed, type Ref } from 'vue'
import { theme } from 'ant-design-vue'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'

export function useAntdTheme(effectiveTheme: Ref<'light' | 'dark'>) {
  return computed<ThemeConfig>(() => ({
    algorithm: effectiveTheme.value === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#2563eb',
      borderRadius: 8,
      fontSize: 14,
      colorBgLayout: effectiveTheme.value === 'dark' ? '#111113' : '#f7f7f8',
      colorBgContainer: effectiveTheme.value === 'dark' ? '#1a1a1d' : '#ffffff',
      colorBgElevated: effectiveTheme.value === 'dark' ? '#202024' : '#ffffff',
      colorBorder: effectiveTheme.value === 'dark' ? '#303036' : '#dcdee4',
      colorText: effectiveTheme.value === 'dark' ? '#f4f4f5' : '#18181b',
      colorTextSecondary: effectiveTheme.value === 'dark' ? '#d4d4d8' : '#3f3f46',
      colorTextTertiary: effectiveTheme.value === 'dark' ? '#a1a1aa' : '#71717a',
    },
    components: {
      Card: {
        borderRadiusLG: 8,
      },
      Table: {
        headerBg: effectiveTheme.value === 'dark' ? '#202024' : '#f1f2f4',
        rowHoverBg: effectiveTheme.value === 'dark' ? '#202024' : '#f7f7f8',
      },
    },
  }))
}
