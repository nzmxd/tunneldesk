import { computed, type Ref } from 'vue'
import { theme } from 'ant-design-vue'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'

export function useAntdTheme(effectiveTheme: Ref<'light' | 'dark'>) {
  return computed<ThemeConfig>(() => ({
    algorithm: effectiveTheme.value === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#24766f',
      borderRadius: 6,
      fontSize: 14,
      colorBgLayout: effectiveTheme.value === 'dark' ? '#101418' : '#eef2f6',
      colorBgContainer: effectiveTheme.value === 'dark' ? '#171c22' : '#ffffff',
    },
    components: {
      Card: {
        borderRadiusLG: 8,
      },
      Table: {
        headerBg: effectiveTheme.value === 'dark' ? '#1f252c' : '#f8fafc',
      },
    },
  }))
}
