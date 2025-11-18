<script setup lang="ts">
const emit = defineEmits(['update:roomOpen'])

const closeRoom = () => emit('update:roomOpen', false)
</script>

<template>

  <header class="flex justify-between items-center">

    <!-- Left Section -->
    <div class="rounded-md flex items-center border border-primary-800 bg-gradient-to-br to-primary/60 gap-1 backdrop-blur-xs">
      <div class="w-10">
        <Avatar :animated="true" />
        <p class="text-xs text-center">LvL. 15</p>
      </div>

      <div>
        <div class="flex items-center justify-between gap-2 pr-1">
          <div>
            <p class="text-xs leading-tight">UserSignature</p>
            <h1 class="text-sm font-bold leading-tight">Room Name</h1>
          </div>
          <UButton icon="i-lucide-bookmark" variant="subtle" class="shadow-md shadow-primary-950/50" size="sm" />
        </div>

        <div class="flex items-center gap-1 mt-1">
          <NuxtImg
              v-for="i in 4"
              :key="i"
              provider="imagekit"
              src="/siteAssets/badges/badge-wealth-level-3.webp"
              class="size-4"
          />
        </div>
      </div>
    </div>

    <!-- Right Section -->
    <div class="flex items-center ml-auto gap-2">
      <UButton
          icon="i-lucide-share-2"
          size="xl"
          class="rounded-full border border-primary-600 cursor-pointer shadow-lg shadow-primary-950/50 backdrop-blur-xs"
          variant="subtle"
      />

      <UButton
          icon="i-lucide-x"
          size="xl"
          class="rounded-full border border-primary-600 cursor-pointer shadow-lg shadow-primary-950/50 backdrop-blur-xs"
          variant="subtle"
          @click="closeRoom"
      />
    </div>

  </header>

</template>

<style scoped>

</style>