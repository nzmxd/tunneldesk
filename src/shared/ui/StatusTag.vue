<script setup lang="ts">
import { computed } from 'vue'
import type { ServiceState } from '@/shared/types'
import { serviceStateColor, serviceStateText } from '@/shared/domain/serviceStatus'

const props = defineProps<{
  state?: ServiceState
  text?: string
}>()

const color = computed(() => serviceStateColor(props.state))
const label = computed(() => props.text || serviceStateText(props.state))
</script>

<template>
  <a-tag :color="color">{{ label }}</a-tag>
</template>
