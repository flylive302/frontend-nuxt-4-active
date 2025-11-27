<script setup lang="ts">
import { ref } from 'vue'
import { useScreenSafeArea, useMutationObserver } from '@vueuse/core'

const {
  top,
  right,
  bottom,
  left,
} = useScreenSafeArea()

const shellRef = ref<HTMLElement | null>(null)
useMutationObserver(shellRef, () => {
  const el = shellRef.value
  if (!el) {
    return
  }

  const ariaHidden = el.getAttribute('aria-hidden')

  if (ariaHidden === 'true') {
    el.setAttribute('inert', '')
    const activeElement = document.activeElement

    if (activeElement instanceof HTMLElement && el.contains(activeElement)) {
      activeElement.blur()
    }
  } else {
    el.removeAttribute('inert')
  }
}, {
  attributes: true,
  attributeFilter: ['aria-hidden'],
})

</script>

<template>
  <div
      ref="shellRef"
      class="fixed bg-black z-50 p-1 overscroll-none"
      :style="`top: -${top}; bottom: ${bottom};left: ${left};right: ${right}`"
  >
    <div class="fixed inset-0 z-0">
      <div class="fixed inset-0 z-0 bg-gray-950/20"/>
      <NuxtImg provider="imagekit" src="/siteAssets/backgrounds/eagle.jpg" class="size-full object-cover" />
    </div>

    <div class="relative z-10 h-full flex flex-col">
      <RoomHeader />

      <RoomInfo />

      <main class="grid grid-cols-5 gap-x-1 gap-y-1 px-1">
        <RoomSeat v-for="i in 15" :key="i" :seat-id="i" />

        <RoomSeatDrawer />
      </main>

      <div class="flex flex-grow gap-1 mt-1">
        <div class="min-h-full w-full flex flex-col">
          <div class="bg-gradient-to-br to-primary-900 p-3 border border-primary rounded-lg flex-grow"/>
          <div class="flex gap-2 p-1">
            <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
            <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
            <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
            <UButton icon="i-lucide-heart" size="md" variant="subtle"/>
          </div>
        </div>
        <div class="flex flex-col items-center gap-1 justify-end">
          <NuxtImg src="/room/room-prop.png" alt="room prop" class="w-12" />
          <NuxtImg src="/room/room-prop-2.png" alt="room prop" class="w-12" />
          <NuxtImg src="/room/room-prop-2.png" alt="room prop" class="w-12" />
          <RoomGiftingDrawer />
        </div>
      </div>
    </div>

  </div>
</template>
