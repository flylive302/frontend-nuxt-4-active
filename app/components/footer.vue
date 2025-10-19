<template>
  <div class="fixed z-50 bottom-2 left-2 right-2">
    <BgGlass
        class="border border-white/20 shadow-lg rounded-lg overflow-hidden"
        frostBlurRadius="blur(2px)" :noiseFrequency="0.004" :noiseStrength="150"
    >
      <div class="flex justify-between items-center px-3 py-2">
        <UButton icon="i-lucide-house" size="xl" color="primary" variant="solid" />
        <UButton icon="i-lucide-contact-round" size="xl" color="primary" variant="subtle" />
        <UButton icon="i-lucide-bell-plus" size="xl" color="primary" variant="subtle" />
        <Avatar :frame_overflow="130" class="w-12 cursor-pointer" />
      </div>
    </BgGlass>
  </div>
</template>
<script setup lang="ts">
</script>