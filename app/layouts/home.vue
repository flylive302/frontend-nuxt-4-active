<script setup lang="ts">
</script>

<template>
  <div>
    <div class="fixed inset-0 -z-10 overflow-hidden bg-neutral-900">
      <!-- LCP element - first visible image with high priority -->
      <div class="bg-primary size-60 rounded-full blur-3xl -mt-50 mx-auto"></div>
    </div>
    <NavHome />

    <div class="h-16"/>

    <slot />

    <NavHomeFooter />
  </div>
</template>