<script setup lang="ts">
/**
 * Error state for the /rank page with a retry button.
 */
defineProps<{
  message: string
}>()

defineEmits<{
  (e: 'retry'): void
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 text-center">
    <div class="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center mb-3">
      <UIcon name="i-lucide-circle-alert" class="w-7 h-7 text-error" />
    </div>
    <p class="text-sm font-medium text-white">Couldn’t load the leaderboard</p>
    <p class="text-xs text-muted mt-1 max-w-xs">{{ message }}</p>
    <UButton size="sm" color="primary" variant="soft" class="mt-3" @click="$emit('retry')">
      Try again
    </UButton>
  </div>
</template>
