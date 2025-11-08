<script setup lang="ts">
withDefaults(defineProps<{
  id?: string
  name?: string
  members?: number
  countryCode?: string
  avatar?: string
}>(), {
  id: 'abc-01',
  name: 'Agency Name',
  members: 589,
  countryCode: 'us',
  avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Digital%20Horizon',
})
</script>

<template>
  <NuxtLink :to="`/agency/${id}-profile`" class="rounded-lg overflow-hidden border-2 border-primary">
    <NuxtImg :src="avatar" class="aspect-square shadow-lg shadow-primary-950" />
    <div class="p-2 bg-gradient-to-br to-primary/90">
      <h2 class="text-base font-bold truncate">{{ name }}</h2>
      <div class="flex justify-between items-center mt-1">
        <icon name="i-flag-ad-4x3" class="size-8 rounded overflow-hidden h-6 shadow-md shadow-primary/50" />
        <p class="text-2xl font-bold flex gap-2 leading-none"><icon class="size-7" name="i-lucide-users"/>
          {{ members }}
        </p>
      </div>
    </div>
  </NuxtLink>
</template>