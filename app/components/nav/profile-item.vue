<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  to?: string
  txt?: string
}>(), {
  icon: 'i-lucide-wallet',
  to: '/',
  txt: 'Navigation Item'
})
</script>

<template>
  <NuxtLink :to="to" class="flex w-full py-1">
    <UButton class="text-primary backdrop-blur-xl" :icon="icon" size="xl" variant="subtle" />

    <p class="text-base font-semibold flex-auto flex items-center pl-3">{{ txt }}</p>

    <UButton class="text-primary backdrop-blur-xl" icon="i-lucide-chevron-right" size="xl" variant="soft" />
  </NuxtLink>
</template>

<style scoped>

</style>