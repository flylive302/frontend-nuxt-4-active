<script setup lang="ts">
import { ASSETS } from '~/constants/assets'

definePageMeta({ layout: 'cp', middleware: 'auth' })
</script>

<template>
  <section class="min-h-screen">
    <!-- 9-slice frame: top art (rows 0-410 of card-top) / stretchable band / bottom art (rows 58-326 of card-bottom) -->
    <img :src="ASSETS.CP_FERRIS_CARD_TOP" width="1480" height="600" fetchpriority="high" alt="" class="block h-auto w-full aspect-1480/410 object-cover object-top select-none">
    <div class="frame-body -my-px -mt-12 px-[6%] text-white">
      <p class="">Top Three Couples on the History List will be displayed here</p>
    </div>
    <img :src="ASSETS.CP_FERRIS_CARD_BOTTOM" width="1480" height="326" loading="lazy" decoding="async" alt="" class="block h-auto w-full aspect-1480/268 object-cover object-bottom select-none">
  </section>
</template>

<style scoped>
/* Gold side strips + purple gradient come from card-top's band (rows 410-598): no extra request.
   Slice 59px sides at 1480px wide = 3.986% of our width, so it lines up with the <img>s above/below. */
.frame-body {
  border: 0 solid;
  border-image: url('/images/cp-event/card-top.webp') 410 59 2 59 fill / 0 3.986% / 0 stretch;
}
</style>
