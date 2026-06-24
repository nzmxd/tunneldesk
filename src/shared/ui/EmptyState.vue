<script setup lang="ts">
defineProps<{
  description: string
}>()
</script>

<template>
  <a-empty :description="description" />
</template>
