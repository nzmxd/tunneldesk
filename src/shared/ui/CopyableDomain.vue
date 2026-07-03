<script setup lang="ts">
import { computed } from 'vue'
import { CopyOutlined } from '@ant-design/icons-vue'
import { copyTextToClipboard } from '@/shared/domain/clipboard'
import { useAppStore } from '@/stores/appStore'

const props = withDefaults(defineProps<{
  value: string
  mono?: boolean
}>(), {
  mono: false,
})

const store = useAppStore()
const title = computed(() => (props.value ? `${props.value}（点击复制）` : '无域名'))

async function copyDomain() {
  const copied = await copyTextToClipboard(props.value)
  if (copied) {
    store.setMessage('success', `已复制域名：${props.value}`)
    return
  }
  store.setMessage('error', '复制域名失败')
}
</script>

<template>
  <button
    type="button"
    class="copyable-domain"
    :class="{ mono }"
    :title="title"
    :disabled="!value"
    @click.stop="copyDomain"
  >
    <span class="copyable-domain-text">{{ value || '-' }}</span>
    <CopyOutlined class="copyable-domain-icon" />
  </button>
</template>

<style scoped>
.copyable-domain {
  display: inline-flex;
  max-width: 100%;
  min-width: 0;
  align-items: center;
  gap: 6px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  padding: 0;
  text-align: left;
  vertical-align: middle;
}

.copyable-domain:hover {
  color: #1677ff;
}

.copyable-domain:disabled {
  color: var(--text-muted);
  cursor: default;
}

.copyable-domain-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copyable-domain-icon {
  flex: 0 0 auto;
  font-size: 12px;
  opacity: 0.65;
}
</style>
