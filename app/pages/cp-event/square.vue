<script setup lang="ts">
import { ASSETS } from '~/constants/assets'

definePageMeta({ layout: 'cp', middleware: 'auth' })
</script>

<template>
  <section class="min-h-screen">
    <!-- 9-slice frame: top art (rows 0-410 of card-top) / stretchable band / bottom art (rows 58-326 of card-bottom) -->
    <img :src="ASSETS.CP_CARD_TOP" width="1480" height="600" fetchpriority="high" alt="" class="block h-auto w-full aspect-1480/410 object-cover object-top select-none">
    <div class="frame-body -my-px -mt-12 px-[6%] text-white">
      <p class="text-center my-3">Top Three Couples on the History List will be displayed here</p>
      <img alt="" :src="ASSETS.CP_DEVIDER" />
      <p class="text-center my-3">10/13/2026 - 11/13/2026</p>
      <!-- TOP 1 WINNER PODIUM -->
      <div class="relative">
        <img alt="" :src="ASSETS.CP_DECORATION_TOP_1" />
        <div class="grid grid-cols-2 w-full px-22 gap-2 absolute top-8">
          <div class="flex-col justify-center items-center text-center text-xs leading-none">
            <UserAvatar
                :frame-image-url="ASSETS.CP_RANK_FRAME"
                user-name="Steve Fox"
                :img="ASSETS.AVATAR_PLACEHOLDER"
            />
            <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
            <p>ID: 7897897</p>
          </div>

          <div class="flex-col justify-center items-center text-center text-xs leading-none">
            <UserAvatar
                :frame-image-url="ASSETS.CP_RANK_FRAME"
                user-name="Steve Fox"
                :img="ASSETS.AVATAR_PLACEHOLDER"
            />
            <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
            <p>ID: 7897897</p>
          </div>

          <div class="col-span-2 flex justify-center">
            <div class="rounded-xl px-2 mb-1 bg-neutral-950/50">
              <MarqueeName
                  text-class="text-xs font-semibold text-center leading-none"
                  name="❤️ OK"
              />
            </div>
          </div>
        </div>

      </div>

      <!-- TOP 2 and 3 WINNER PODIUM -->
      <div class="flex mt-2 justify-center">
        <div class="relative">
          <img alt="" :src="ASSETS.CP_DECORATION_TOP_2" />
          <div class="grid grid-cols-2 w-full px-4 gap-2 absolute top-8">
            <div class="flex-col justify-center items-center text-center text-xs leading-none">
              <UserAvatar
                  :frame-image-url="ASSETS.CP_RANK_FRAME"
                  user-name="Steve Fox"
                  :img="ASSETS.AVATAR_PLACEHOLDER"
              />
              <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
              <p>ID: 7897897</p>
            </div>

            <div class="flex-col justify-center items-center text-center text-xs leading-none">
              <UserAvatar
                  :frame-image-url="ASSETS.CP_RANK_FRAME"
                  user-name="Steve Fox"
                  :img="ASSETS.AVATAR_PLACEHOLDER"
              />
              <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
              <p>ID: 7897897</p>
            </div>

            <div class="col-span-2 flex justify-center">
              <div class="rounded-xl px-2 mb-1 bg-neutral-950/50">
                <MarqueeName
                    text-class="text-xs font-semibold text-center leading-none"
                    name="❤️ OK"
                />
              </div>
            </div>
          </div>

        </div>

        <div class="relative">
          <img alt="" :src="ASSETS.CP_DECORATION_TOP_2" />
          <div class="grid grid-cols-2 w-full px-4 gap-2 absolute top-8">
            <div class="flex-col justify-center items-center text-center text-xs leading-none">
              <UserAvatar
                  :frame-image-url="ASSETS.CP_RANK_FRAME"
                  user-name="Steve Fox"
                  :img="ASSETS.AVATAR_PLACEHOLDER"
              />
              <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
              <p>ID: 7897897</p>
            </div>

            <div class="flex-col justify-center items-center text-center text-xs leading-none">
              <UserAvatar
                  :frame-image-url="ASSETS.CP_RANK_FRAME"
                  user-name="Steve Fox"
                  :img="ASSETS.AVATAR_PLACEHOLDER"
              />
              <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
              <p>ID: 7897897</p>
            </div>

            <div class="col-span-2 flex justify-center">
              <MarqueeName
                  text-class="text-xs font-semibold text-center drop-shadow-lg leading-none rounded-xl px-2 px-1 mb-1 bg-neutral-950/50"
                  name="❤️ OK"
              />
            </div>
          </div>

        </div>
      </div>
    </div>
    <img :src="ASSETS.CP_CARD_BOTTOM" width="1480" height="326" loading="lazy" decoding="async" alt="" class="block h-auto w-full aspect-1480/268 object-cover object-bottom select-none">
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
