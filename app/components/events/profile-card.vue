<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
const items = [
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
  'siteAssets/room/room-card-top.webp',
]
</script>

<template>
  <UCarousel
      :items="items"
      :autoplay="{ delay: 4000 }"
      :ui="{item: 'basis-9/11'}"
  >
    <div class="relative aspect-rectangle">
      <svga-player name="https://assets.flyliveapp.com/events/cp/3.svga" />
    </div>
  </UCarousel>
</template>

<style scoped>

</style>