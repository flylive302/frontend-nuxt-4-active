<script setup lang="ts">
const props = withDefaults(
    defineProps<{
      name?: string
      category?: string
      label?: string
      price?: number
      autoCloseMs?: number
    }>(),
    {
      name: 'castle',
      category: 'castle',
      label: 'Castle',
      price: 3000,
      autoCloseMs: 3000
    }
)
</script>

<template>
  <!-- Trigger -->
  <div class="flex flex-col items-center bg-primary/10 border border-primary rounded cursor-pointer">
    <div class="p-1 w-full">
      <NuxtImg
          :src="`/parsedAnimations/gifts/${category}/castle/static/${name}.png`"
          alt="Castle"
          class="w-full shadow-md shadow-primary-950 rounded"
      />
    </div>

    <p class="text-xs truncate w-full text-center">
      {{ props.name }}
    </p>

    <p class="text-sm font-bold truncate w-full text-center">
      <Icon name="i-lucide-coins" class="bg-tertiary" /> 40
    </p>
  </div>
</template>
