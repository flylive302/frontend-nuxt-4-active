<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
</script>

<template>
  <div class="flex">
    <NuxtImg
        :src="ASSETS.LOGO_MAIN"
        alt="FlyLive"
        preload
        fetchpriority="high"
        class="h-10 mt-1"
    />
    <NuxtImg
        :src="ASSETS.LOGO_TEXT"
        alt=""
        preload
        fetchpriority="high"
        class="h-10 mt-2"
    />
  </div>
</template>