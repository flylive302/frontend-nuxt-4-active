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
    readiness?: 'idle' | 'checking' | 'ready' | 'error';
  }>(),
  {
    selected: false,
    readiness: 'idle',
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
      <div
        v-if="selected && readiness === 'checking'"
        class="absolute inset-0 flex items-center justify-center rounded bg-black/40"
      >
        <UIcon name="i-lucide-loader-2" class="animate-spin size-5 text-white" />
      </div>
      <!-- Preload failed (e.g. asset CDN/CORS) — non-blocking. The gift still
           sends; playback falls back to the direct asset URL. Show a subtle
           corner warning rather than a blocking overlay. -->
      <div
        v-else-if="selected && readiness === 'error'"
        class="absolute top-0.5 right-0.5 flex items-center justify-center rounded-full bg-amber-500/90 size-4"
        :title="'Preview not preloaded — gift will still send'"
      >
        <UIcon name="i-lucide-triangle-alert" class="size-2.5 text-white" />
      </div>
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
