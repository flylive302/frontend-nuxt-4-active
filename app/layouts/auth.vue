<script setup lang="ts">
useThemeColor('#000002')

const route = useRoute()

const authHeading = computed(() => route.meta.authHeading as string | undefined)
</script>

<template>
  <main class="relative h-screen w-screen overflow-x-hidden pt-16">
    <div class="absolute z-0 -top-30 left-1/2 -translate-x-1/2 blur-3xl bg-primary/20 rounded-full size-64 animate-pulse will-change-[opacity]"/>
    <h1 class="text-3xl font-bold text-center w-60 mx-auto">{{authHeading}}</h1>

    <div class="flex justify-between w-full mx-auto  relative z-10 pointer-events-none select-none" aria-hidden="true">
      <img src="/images/auth-deco.png" width="180" height="auto" class="-rotate-9 scale-x-[-1]" loading="lazy" fetchpriority="low" decoding="async" alt="">
      <img src="/images/auth-deco.png" width="180" height="auto" class="rotate-9" loading="lazy" fetchpriority="low" decoding="async" alt="">
    </div>

    <div class="p-6 relative z-10 backdrop-blur-sm -mt-18 min-h-full">
      <slot />
      <USeparator color="primary" class="my-4" label="OR" />
      <AuthSocialAuth class="w-full" />
    </div>
  </main>
</template>