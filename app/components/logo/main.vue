<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
</script>

<template>
  <div class="flex">
    <NuxtImg
        :src="ASSETS.LOGO_MAIN"
        alt="FlyLive"
        width="64"
        height="40"
        sizes="64px"
        preload
        fetchpriority="high"
        class="h-10 mt-1 w-auto"
    />
    <NuxtImg
        :src="ASSETS.LOGO_TEXT"
        alt=""
        width="111"
        height="40"
        sizes="111px"
        preload
        fetchpriority="high"
        class="h-10 mt-2 w-auto"
    />
  </div>
</template>