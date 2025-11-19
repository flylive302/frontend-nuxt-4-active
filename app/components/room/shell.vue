<script setup lang="ts">
import { useScreenSafeArea } from '@vueuse/core'

withDefaults(defineProps<{
  roomOpen?: boolean
}>(),{
  roomOpen: false
});

const {
  top,
  right,
  bottom,
  left,
} = useScreenSafeArea()

const emit = defineEmits(['update:roomOpen'])

const closeRoom = () => emit('update:roomOpen', false)
</script>

<template>
  <div
      class="fixed bg-black z-50 p-1 overscroll-none"
      :style="`top: -${top}; bottom: ${bottom};left: ${left};right: ${right}`"
      :class="roomOpen ? 'show-content' : 'hide-content'"
  >
    <div class="fixed inset-0 z-0">
      <div class="fixed inset-0 z-0 bg-gray-950/20"/>
      <NuxtImg provider="imagekit" src="/siteAssets/backgrounds/eagle.jpg" class="size-full object-cover" />
    </div>

    <div class="relative z-10 h-full flex flex-col">
      <RoomHeader @update:room-open="closeRoom"/>

      <RoomInfo />

      <main class="grid grid-cols-5 gap-x-1 gap-y-1 px-1">
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
        <RoomSeat />
      </main>

      <div class="flex flex-grow gap-1 mt-1">
        <div class="bg-gradient-to-br to-primary-900 p-3 min-h-full w-full border border-primary rounded-lg"/>
        <div class="flex flex-col items-center gap-1 justify-end">
          <NuxtImg src="/room/room-prop.png" alt="room prop" class="w-12" />
          <NuxtImg src="/room/room-prop-2.png" alt="room prop" class="w-12" />
          <NuxtImg src="/room/room-prop-2.png" alt="room prop" class="w-12" />
        </div>
      </div>

      <div class="flex gap-2 p-1">
        <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
        <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
        <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
        <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
        <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
        <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
      </div>
    </div>

  </div>
</template>
