<template>
  <header class="fixed z-50 top-0 left-0 right-0">
    <BgGlass class="shadow-xl" frostBlurRadius="blur(2px)" :noiseFrequency="0.004" :noiseStrength="150">
      <nav class="flex justify-between items-center p-1">
        <LogoMain class="w-14" />
        <div class="flex justify-between gap-2 items-center">
          <UButton icon="i-lucide-earth" size="xl" color="primary" variant="ghost" />
          <UButton size="md" variant="ghost">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none"><path fill="#fff" d="M11.056 2.115 10.32.248c-.122-.325-.503-.336-.638 0l-.737 1.867-1.635.293c-.29.054-.415.503-.2.773l1.188 1.445-.281 2.035c-.044.363.256.645.525.477l1.465-.969 1.457.953c.268.168.571-.113.525-.476l-.282-2.035 1.188-1.43c.212-.266.09-.715-.2-.773l-1.635-.293h-.003ZM8 10c-.553 0-1 .558-1 1.25v7.5C7 19.44 7.447 20 8 20h4c.553 0 1-.559 1-1.25v-7.5c0-.69-.447-1.25-1-1.25H8Zm-7 2.5c-.553 0-1 .558-1 1.25v5C0 19.44.447 20 1 20h4c.553 0 1-.559 1-1.25v-5c0-.69-.447-1.25-1-1.25H1Zm13 3.75v2.5c0 .69.447 1.249 1 1.249h4c.553 0 1-.559 1-1.25v-2.5c0-.691-.447-1.25-1-1.25h-4c-.553 0-1 .559-1 1.25Z"/></svg>
          </UButton>
          <UButton icon="i-lucide-search" size="xl" color="primary" variant="ghost" />
        </div>
      </nav>
    </BgGlass>
  </header>
</template>
<script setup lang="ts">
</script>