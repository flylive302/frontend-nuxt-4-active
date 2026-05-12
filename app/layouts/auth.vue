<script setup lang="ts">
useThemeColor('#000002')

const route = useRoute()

const authHeading = computed(() => route.meta.authHeading as string | undefined)
</script>

<template>
  <main class="px-4 mt-16">
    <h1 class="text-3xl font-bold text-center w-60 mb-4 mx-auto">{{authHeading}}</h1>
    <slot />
    <USeparator color="primary" class="my-4" label="OR" />
    <AuthSocialAuth class="w-full" />
  </main>
</template>