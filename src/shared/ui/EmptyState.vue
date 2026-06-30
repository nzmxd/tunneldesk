<script setup lang="ts">
defineProps<{
  description: string
}>()
</script>

<template>
  <div class="py-10">
    <a-empty :description="description" />
  </div>
</template>
