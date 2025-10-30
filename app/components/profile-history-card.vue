<script setup lang="ts">
withDefaults(defineProps<{
  badgeSrc?: string
  itemName?: string
}>(), {
  badgeSrc: '/siteAssets/badges/badge-profile-1.webp',
  itemName: 'Item Name',
})
</script>

<template>
  <div class="bg-primary/30 p-2 border border-primary rounded-md flex flex-col justify-between items-center">
    <NuxtImg provider="imagekit" :src="badgeSrc" />
    <p class="text-xs truncate text-center">{{ itemName }}</p>
  </div>
</template>

<style scoped>

</style>