<script setup lang="ts">
withDefaults(defineProps<{
  badgeSrc?: string
  timeLeft?: string
}>(), {
  badgeSrc: '/siteAssets/badges/badge-profile-1.webp',
  timeLeft: '13D-3H-25s',
})
</script>

<template>
  <div class="bg-secondary/30 border border-secondary rounded-md overflow-hidden">
    <p class="text-sm truncate text-center text-success font-bold leading-tight">Time Left: <br> {{ timeLeft }}</p>
    <UserAvatar :animated="true" />

    <UButton size="sm" icon="i-lucide-power" color="secondary" class="w-full justify-center">Activate</UButton>
  </div>
</template>
