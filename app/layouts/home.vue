<script setup lang="ts">
const assetStore = useAssetStore()
const { hasDegradedAssets } = storeToRefs(assetStore)
</script>

<template>
  <div>
    <div class="fixed inset-0 -z-10 overflow-hidden bg-neutral-900">
      <!-- LCP element - first visible image with high priority -->
      <div class="bg-primary size-60 rounded-full blur-3xl -mt-50 mx-auto"/>
    </div>
    <NavHome />

    <div class="h-16"/>

    <div
      v-if="hasDegradedAssets"
      class="flex items-center gap-2 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-400"
    >
      <UIcon name="i-lucide-triangle-alert" class="size-4 shrink-0" />
      <span>Some assets couldn't load — visuals in rooms may be missing.</span>
    </div>

    <slot />

    <NavHomeFooter />
  </div>
</template>