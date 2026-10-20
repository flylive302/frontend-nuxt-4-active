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
import { isBindingGift } from '~/utils/gift';

const props = withDefaults(
  defineProps<{
    gift: Gift;
    selected?: boolean;
  }>(),
  {
    selected: false,
  }
);

const { formatGiftPrice } = useGiftData();

const isBinding = computed(() => isBindingGift(props.gift));
</script>

<template>
  <div
    class="flex flex-col items-center rounded cursor-pointer transition-all"
    :class="[
      selected
        ? 'bg-primary/30 ring-primary! scale-102'
        : isBinding
          ? 'ring-1 ring-pink-400/80'
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
      <span
        v-if="isBinding"
        class="absolute top-0 right-0 rounded-full bg-pink-500 px-1.5 text-[10px] font-semibold leading-4 text-white"
      >
        Bind
      </span>
      <!-- No load/ready indication by design: preloading is silent (ticket 11).
           If the asset is cold, playback fetches it directly. -->
    </div>
    <MarqueeName
        text-class="text-xs w-full text-center px-1"
        :name="gift.label ?? 'Gift'"
    />

    <p class="text-xs font-medium truncate w-full text-center pb-1">
      {{ formatGiftPrice(gift) }}
    </p>
  </div>
</template>
