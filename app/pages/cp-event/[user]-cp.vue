<script setup lang="ts">
import { ASSETS } from '~/constants/assets'

definePageMeta({
  middleware: 'auth',
})
</script>

<template>
  <main>
    <NavAlt spacer back-to="/profile">CP Event</NavAlt>
    <div class="relative h-screen max-h-screen overflow-y-auto bg-cover pb-24" :style="{ backgroundImage: `url(${ASSETS.CP_USER_BACKGROUND})` }">
      <img :src="ASSETS.CP_USER_DECORATION" alt="">
      <div class="grid grid-cols-3 w-full px-22 -mt-50">
        <div class="flex-col justify-center items-center text-center text-xs leading-none">
          <UserAvatar
              :animated="true"
              :frame-id="29"
              :img="ASSETS.AVATAR_PLACEHOLDER"
          />
          <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
          <ProfileBadge txt="ID: 7897897" :vip="10" />
        </div>

        <div class="flex flex-col justify-end">
          <img :src="ASSETS.CP_USER_BINDING_ICON" class="-ml-0.5" alt="">
        </div>

        <div class="flex-col justify-center items-center text-center text-xs leading-none">
          <UserAvatar
              :animated="true"
              :frame-id="29"
              :img="ASSETS.AVATAR_PLACEHOLDER"
          />
          <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
          <ProfileBadge txt="ID: 7897897" :vip="10" />
        </div>

        <div class="col-span-3 h-24 mt-4 relative">
          <img :src="ASSETS.CP_USER_STATS_DECOR" class="relative z-0" alt="">
          <p class="text-xl w-full mx-auto font-bold text-center -mt-14 relative z-10">18.1 M</p>
        </div>
      </div>
      
      <div class="rounded-xl glowing-border mx-4 mt-2">
        <div class="grid grid-cols-3 h-full items-center pb-1">
          <div class="">
            <p class="text-xl font-bold text-center">51</p>
            <p class="text-sm font-semibold text-center">Days</p>
          </div>
          <div class="">
            <p class="text-xl font-bold text-center">18 M</p>
            <p class="text-sm font-semibold text-center">CP Intimacy</p>
          </div>
          <div class="">
            <p class="text-xl font-bold text-center">51</p>
            <p class="text-sm font-semibold text-center">Ranking</p>
          </div>
        </div>
      </div>

      <div v-for="i in 5" :key="i" class="px-4">
        <img :src="ASSETS.CP_CARD_TOP" width="1480" height="600" fetchpriority="high" alt="" class="block h-auto w-full aspect-1480/410 object-cover object-top select-none">
        <div class="frame-body -my-px -mt-12 px-[6%] text-white">

          <div class="flex justify-between w-full">
            <div class="flex-col justify-center items-center text-center text-xs leading-none w-1/4">
              <UserAvatar
                  :animated="true"
                  :frame-id="28"
                  :img="ASSETS.AVATAR_PLACEHOLDER"
              />
              <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
              <ProfileBadge txt="ID: 7897897" :vip="10" />
            </div>

            <div class="flex flex-col justify-center w-1/4">
              <img :src="ASSETS.CP_USER_BINDING_ICON" class="-ml-0.5" alt="">
            </div>

            <div class="flex-col justify-center items-center text-center text-xs leading-none w-1/4">
              <UserAvatar
                  :animated="true"
                  :frame-id="28"
                  :img="ASSETS.AVATAR_PLACEHOLDER"
              />
              <MarqueeName text-class=" font-bold leading-none" name="User Name" :vip="10" />
              <ProfileBadge txt="ID: 7897897" :vip="10" />
            </div>
          </div>

          <img alt="" :src="ASSETS.CP_DEVIDER" />

          <div class="rounded-xl glowing-border mt-3 -mb-6">
            <div class="grid grid-cols-3 h-full items-center pb-1">
              <div class="">
                <p class="text-xl font-bold text-center">30</p>
                <p class="text-sm font-semibold text-center">Days</p>
              </div>
              <div class="">
                <p class="text-xl font-bold text-center">12 M</p>
                <p class="text-sm font-semibold text-center">CP Intimacy</p>
              </div>
              <div class="">
                <p class="text-xl font-bold text-center">68</p>
                <p class="text-sm font-semibold text-center">Ranking</p>
              </div>
            </div>
          </div>

        </div>
        <img :src="ASSETS.CP_CARD_BOTTOM" width="1480" height="326" loading="lazy" decoding="async" alt="" class="block h-auto w-full aspect-1480/268 object-cover object-bottom select-none">
      </div>

    </div>
  </main>
</template>

<style scoped>

</style>