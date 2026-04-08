<template>
  <div class="fixed inset-0 -z-10 overflow-hidden bg-neutral-900">
    <!-- LCP element - first visible image with high priority -->
    <NuxtImg
        src="/background-decorations/var-1/1-top-left-image.webp"
        class="absolute -top-5 left-0"
        format="webp"
        width="100"
        height="50"
        loading="lazy"
    />
    <NuxtImg
        src="/background-decorations/var-1/2-top-right-image.webp"
        class="absolute top-0 right-0"
        format="webp"
        width="100"
        height="50"
        loading="lazy"
    />
    <NuxtImg
        src="/background-decorations/var-1/3-bottom-middle-image.webp"
        class="fixed bottom-0 left-1/2 -translate-x-1/2 animate-pulse"
        format="webp"
        width="200"
        height="100"
        loading="lazy"
    />
    <NuxtImg
        src="/background-decorations/var-1/4-bottom-right-image.webp"
        class="absolute bottom-0 right-0"
        format="webp"
        width="100"
        height="50"
        loading="lazy"
    />
    <NuxtImg
        src="/background-decorations/var-1/5-bottom-left-image.webp"
        class="absolute bottom-0 left-0"
        format="webp"
        width="100"
        height="50"
        loading="lazy"
    />
  </div>
</template>
<script setup lang="ts">
</script>