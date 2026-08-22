<script setup lang="ts">
/**
 * Gift Card
 *
 * Displays a single gift item in the gift grid.
 */
import type { Gift } from '~/types/gift/gift';
import { useGiftData } from '~/composables/gift/useGiftData';
import MarqueeName from "~/components/common/marquee-name.vue";
import { giftThumbnailSrc } from '~/utils/imagekit';

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
        ? 'bg-primary/30 ring-primary! scale-102'
        : '',
    ]"
  >
    <div class="relative p-1 w-full">
      <NuxtImg
        :src="giftThumbnailSrc(gift.thumbnail_url)"
        :alt="gift.label ?? gift.name"
        class="w-full aspect-square object-contain"
        :width="128"
        :height="128"
        format="webp"
        densities="x1 x2"
        sizes="128px"
        loading="lazy"
      />
      <!-- No load/ready indication by design: preloading is silent (ticket 11).
           If the asset is cold, playback fetches it directly. -->
    </div>
    <MarqueeName
        text-class="text-xs w-full text-center px-1"
        :name="gift.label ?? 'Gift'"
        delay="0s"
    />

    <p class="text-xs font-medium truncate w-full text-center pb-1">
      {{ formatGiftPrice(gift) }}
    </p>
  </div>
</template>
