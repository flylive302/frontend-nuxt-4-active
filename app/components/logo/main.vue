<script setup lang="ts">
import { ASSETS } from '~/constants/assets'
</script>

<template>
  <div class="flex">
    <NuxtImg :src="ASSETS.LOGO_MAIN" preload fetchpriority="high" class="h-10 mt-1"/>
    <NuxtImg :src="ASSETS.LOGO_TEXT" preload fetchpriority="high" class="h-10 mt-2"/>
  </div>
</template>