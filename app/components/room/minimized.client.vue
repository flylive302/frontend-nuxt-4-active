<script setup lang="ts">
import { useDraggable, useWindowSize } from '@vueuse/core'
import { ref, watch } from 'vue'
import { createLogger } from '~/utils/logger';

const log = createLogger('[RoomMinimizedClient]');

 
const roomStore = useRoomStore();
const {leaveRoom} = useRoomAudio();

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

const { width: winW, height: winH } = useWindowSize()

// Element dimensions - measure actual rendered size for accurate clamping
const elW = ref(0)
const elH = ref(0)

const dragEl = ref<HTMLElement | null>(null)

// Position refs - these will be updated by useDraggable
const x = ref(0)
const y = ref(0)

// Setup draggable with position binding
const { position } = useDraggable(dragEl, {
  initialValue: { x: x.value, y: y.value },
  onMove: (pos) => {
    pos.x = clamp(pos.x, 0, winW.value - elW.value)
    pos.y = clamp(pos.y, 0, winH.value - elH.value)
  }
})

// Measure actual element size
if (dragEl.value) {
  const rect = dragEl.value.getBoundingClientRect()
  elW.value = rect.width
  elH.value = rect.height
}

position.value = {
  x: winW.value - elW.value - 95,
  y: winH.value - elH.value - 140
}


// Keep in bounds on window resize
watch([winW, winH], () => {
  if (!dragEl.value) return

  position.value = {
    x: clamp(position.value.x, 0, winW.value - elW.value),
    y: clamp(position.value.y, 0, winH.value - elH.value)
  }
})
</script>

<template>
  <div
      ref="dragEl"
      :style="`left: ${position.x}px; top: ${position.y}px;`"
      class="fixed flex justify-center items-center z-50 touch-none cursor-move"
  >
    <div class="bg-primary size-16 aspect-square p-1 rounded-full z-50" @click="roomStore.maximizeRoom()">
      <NuxtImg
          provider="imagekit"
          src="/siteAssets/room/room-card-top.webp"
          alt="Minimized Room Preview"
          :width="64"
          :height="64"
          :quality="10"
          format="webp"
          class="h-full w-full object-cover rounded-full border pointer-events-none"
      />
    </div>

    <UButton
        class="-ml-2" size="sm" icon="i-lucide-x"
        @click="async () => {
          try {
            leaveRoom();
            roomStore.leaveRoom();
          } catch (error) {
            log.error('Failed to leave room:', error);
          }
        }"
    />
  </div>
</template>