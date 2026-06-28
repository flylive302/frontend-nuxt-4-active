<script setup lang="ts">

import { EVENT_BANNERS } from '~/constants/assets'

defineOptions({ name: 'EventBanners' })

definePageMeta({
  layout: 'home',
  middleware: 'auth'
})

</script>

<template>
  <main>
    <SectionTitle class="px-3">Discover all events</SectionTitle>
    <div class="flex flex-col gap-4 px-3 mt-6 pb-24">
      <NuxtLink v-for="item in EVENT_BANNERS" :key="item.banner" :to="item.navigateTo">
        <img
            :src="item.banner"
            alt=""
            aria-hidden="true"
            width="360"
            height="120"
            class="h-full w-full rounded-lg"
        >
      </NuxtLink>
    </div>
  </main>
</template>
