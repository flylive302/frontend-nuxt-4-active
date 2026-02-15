<script setup lang="ts">
/**
 * Gift Card
 *
 * Displays a single gift item in the gift grid.
 */
import type { Gift } from '~/types/gift/gift';
import { useGiftData } from '~/composables/gift/useGiftData';

withDefaults(
  defineProps<{
    gift: Gift;
    selected?: boolean;
  }>(),
  {
    selected: false,
  }
);

const { formatGiftPrice } = useGiftData();
</script>

<template>
  <div
    class="flex flex-col items-center rounded cursor-pointer transition-all"
    :class="[
      selected
        ? 'bg-primary/20 ring-2 ring-primary'
        : 'bg-primary/5 border border-primary/30 hover:bg-primary/10',
    ]"
  >
    <div class="p-1 w-full">
      <NuxtImg
        :src="gift.thumbnail_url"
        :alt="gift.label ?? gift.name"
        class="w-full aspect-square object-contain rounded"
        :width="128"
        :height="128"
        format="webp"
        densities="x1 x2"
        sizes="128px"
        loading="lazy"
      />
    </div>

    <p class="text-xs truncate w-full text-center px-1">
      {{ gift.label }}
    </p>

    <p class="text-xs font-medium truncate w-full text-center pb-1">
      {{ formatGiftPrice(gift) }}
    </p>
  </div>
</template>
