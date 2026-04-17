<template>
  <main>
    <BackgroundDecorationsVariant1 />

    <div class="px-3 mb-28 pt-15 safe-area-top">
      <LogoLarge class="mx-auto max-w-64"/>

      <slot />
    </div>
  </main>
</template>
<script setup lang="ts">
useThemeColor('#000000')
</script>