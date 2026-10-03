<script setup lang="ts">
import {ASSETS} from "~/constants/assets";

definePageMeta({ layout: 'alt', middleware: 'auth' })
</script>

<template>
  <div>
    <NavAlt spacer>CP Event</NavAlt>
    <div class="bg-primary relative">
      <img :src="ASSETS.CP_HEADER" class="size-full" alt="">
      <div class="ferris-wheel absolute top-80 bg-tertiary p-6">
        <img :src="ASSETS.CP_FERRIS_WHEEL_BOTTOM" class="size-full" alt="">
        <img :src="ASSETS.CP_FERRIS_WHEEL_BASE" class="size-full z-10" alt="">
      </div>
    </div>
  </div>
</template>

<style scoped>

</style>