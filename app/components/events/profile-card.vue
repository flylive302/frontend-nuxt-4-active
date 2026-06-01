<script setup lang="ts">
const items = [
  'https://assets.flyliveapp.com/events/cp/3.svga',
  'https://assets.flyliveapp.com/events/cp/2.svga',
  'https://assets.flyliveapp.com/events/cp/1.svga',
]
</script>

<template>
  <UCarousel
      v-slot="{ item }"
      :items="items"
      :autoplay="{ delay: 4000 }"
      :ui="{ item: 'basis-9/11' }"
  >
    <div class="relative aspect-rectangle">
      <SvgaPlayer :name="item" />
    </div>
  </UCarousel>
</template>