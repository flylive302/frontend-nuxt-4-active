<script setup lang="ts">
import { defineAsyncComponent } from 'vue'

const BackgroundDecorationsVariant1 = defineAsyncComponent(
  () => import('~/components/background-decorations/variant1.vue'),
)
</script>

<template>
  <div>
    <BackgroundDecorationsVariant1 />
    <NavHome />

    <div class="h-16"/>

    <slot />

    <NavHomeFooter />
  </div>
</template>