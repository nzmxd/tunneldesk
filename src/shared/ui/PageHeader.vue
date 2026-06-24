<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
}>()
</script>

<template>
  <div v-if="$slots.actions" class="mb-4 flex flex-wrap items-center justify-end gap-2">
    <slot name="actions" />
  </div>
</template>
