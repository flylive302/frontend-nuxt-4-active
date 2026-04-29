<script setup lang="ts">
/**
 * Empty state for the /rank page — shown when the snapshot table has
 * no rows for the selected (category, period) yet.
 */
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 text-center">
    <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3">
      <UIcon name="i-lucide-trophy" class="w-8 h-8 text-primary" />
    </div>
    <p class="text-sm font-medium text-white">No rankings yet</p>
    <p class="text-xs text-muted mt-1 max-w-xs">
      Once activity rolls in for this period, the leaderboard will populate here.
    </p>
  </div>
</template>
