<script setup lang="ts">
import { ref } from "vue";

const roomOpen = ref(false);
</script>

<template>
  <div :class="roomOpen === true ? 'hide-content' : 'show-content'" class="fixed inset-0 bg-black z-90 show-content">
    <div class="fixed inset-0 z-0">
      <NuxtImg provider="imagekit" src="/siteAssets/room/room-card-top.webp" class="size-full object-cover" />
    </div>
    <div class="relative z-10">
      <header class="p-1 flex justify-between items-center">

        <div class="rounded-md flex items-center border border-primary-800 bg-gradient-to-br to-primary/60 gap-1 backdrop-blur-xs">
          <div class="w-14">
            <Avatar :animated="true"/>
            <p class="text-xs text-center">LvL. 15</p>
          </div>

          <div class="w-full flex flex-col justify-center">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-xs leading-tight">UserSignature</p>
                <h1 class="text-sm font-bold leading-tight">Room Name</h1>
              </div>
              <UButton icon="i-lucide-bookmark" variant="subtle" class="justify-center" size="sm"/>
            </div>
            <div class="flex items-center gap-1 mt-1">
              <NuxtImg provider="imagekit" src="/siteAssets/badges/badge-wealth-level-3.webp" class="size-4" />
              <NuxtImg provider="imagekit" src="/siteAssets/badges/badge-wealth-level-3.webp" class="size-4" />
              <NuxtImg provider="imagekit" src="/siteAssets/badges/badge-wealth-level-3.webp" class="size-4" />
              <NuxtImg provider="imagekit" src="/siteAssets/badges/badge-wealth-level-3.webp" class="size-4" />
            </div>
          </div>
        </div>
        <div class="flex justify-between items-center ml-auto gap-2">
          <UButton icon="i-lucide-share-2" size="xl" class="rounded-full" variant="subtle"/>

          <UButton icon="i-lucide-x" size="xl" class="rounded-full" variant="subtle" @click="roomOpen = !roomOpen"/>
        </div>
      </header>
    </div>
    <RoomMinimized @click="roomOpen = !roomOpen" />
  </div>
</template>