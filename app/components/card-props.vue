<script setup lang="ts">
withDefaults(defineProps<{
  badgeSrc?: string
  validity?: string
  price?: number
}>(), {
  badgeSrc: '/siteAssets/badges/badge-profile-1.webp',
  validity: '156 Days',
  price: 100
})
</script>

<template>
  <div class="bg-secondary/30 border border-secondary rounded-md overflow-hidden">
    <div class="space-x-2 px-2 h-6">
      <UBadge icon="i-lucide-sparkles" color="success" variant="subtle" size="xs">New</UBadge>
      <UBadge icon="i-lucide-flame" color="primary" variant="subtle" size="xs">New</UBadge>
    </div>
    <NuxtImg provider="imagekit" :src="badgeSrc" class="px-2" />
    <p class="text-sm truncate text-center text-success font-bold">Validity: {{ validity }}</p>
    <UButton icon="i-lucide-coins" color="secondary" class="w-full justify-center">{{price}}</UButton>
  </div>
</template>
