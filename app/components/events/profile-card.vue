<script setup lang="ts">
const items = [
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp'
]
</script>

<template>
  <UCarousel
      :items="items"
      :autoplay="{ delay: 4000 }"
      :ui="{item: 'basis-4/11'}"
      class="pl-3"
  >
    <div class="relative aspect-[8/10] overflow-hidden rounded-md border border-white/50">
      <aside class="absolute inset-2">
        <BgGlass
            frost-blur-radius="blur(2px)"
            rounded="rounded-md"
            class="border border-white/30 h-full w-full p-1 flex flex-col justify-between items-center"
        >
          <UserAvatar :animated="true" class="max-w-16"/>
          <UButton size="sm" icon="i-lucide-heart-handshake" class="w-full justify-center">Lover</UButton>
        </BgGlass>
      </aside>

      <NuxtImg
          provider="imagekit"
          src="/siteAssets/room/room-card-top.webp"
          preload
      />
    </div>
  </UCarousel>
</template>

<style scoped>

</style>