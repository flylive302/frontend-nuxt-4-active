<script setup lang="ts">
import { ASSETS } from '~/constants/assets'

// 9-slice page frame: top art (rows 0-410 of card-top) / stretchable band
// (default slot) / bottom art (rows 58-326 of card-bottom). `priority` marks
// the top art as the LCP image (page-level frames only). Single root so a
// caller's `class` lands on the frame instead of being dropped.

defineProps<{
  priority?: boolean
}>()
</script>

<template>
  <div>
    <img :src="ASSETS.CP_CARD_TOP" width="1480" height="600" :fetchpriority="priority ? 'high' : undefined" alt="" class="block h-auto w-full aspect-1480/410 object-cover object-top select-none">
    <div class="frame-body -my-px -mt-12 px-[6%] text-white">
      <slot />
    </div>
    <img :src="ASSETS.CP_CARD_BOTTOM" width="1480" height="326" loading="lazy" decoding="async" alt="" class="block h-auto w-full aspect-1480/268 object-cover object-bottom select-none">
  </div>
</template>
