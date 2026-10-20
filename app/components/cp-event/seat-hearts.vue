<script setup lang="ts">
import {
  CP_SEAT_HEART_SIZE_PX,
  CP_SEAT_HEART_SVGA,
  CP_SEAT_HEARTS_MAX_ANIMATED,
} from '~/constants/cp-event'
import { useCpBindFx } from '~/composables/room/useCpBindFx'

// Overlay of CP hearts between adjacent partner seats, plus the full-screen bind FX
// each time a couple sits together (useCpBindFx). Mounted lazily inside the room's
// seat-grid wrapper (pages/room/[id].vue) only while the CP event is on.
// Live SVGA only on capable (high-tier) devices and only for the first
// CP_SEAT_HEARTS_MAX_ANIMATED hearts; everything else shows the cached still.
// A heart that cannot load renders nothing.

const rootRef = ref<HTMLElement | null>(null)
const { hearts, couples, pairsSynced, hasSeatedPairs } = useCpSeatHearts(rootRef)
useCpBindFx({ couples, pairsSynced, hasSeatedPairs })
const { frameAnimationEnabled } = useFrameAnimationBudget()
const { isVisible } = useDeferredVisibility(rootRef, true)

const heartUrl = ref<string | null>(CP_SEAT_HEART_SVGA)
const { stillUrl } = useAvatarStillFrame(heartUrl)

const sizePx = `${CP_SEAT_HEART_SIZE_PX}px`

function isAnimated(index: number): boolean {
  return frameAnimationEnabled.value && isVisible.value && index < CP_SEAT_HEARTS_MAX_ANIMATED
}

function heartStyle(x: number, y: number) {
  return {
    width: sizePx,
    height: sizePx,
    transform: `translate(${x - CP_SEAT_HEART_SIZE_PX / 2}px, ${y - CP_SEAT_HEART_SIZE_PX / 2}px)`,
  }
}
</script>

<template>
  <div ref="rootRef" class="pointer-events-none absolute inset-0 z-35 overflow-hidden" aria-hidden="true">
    <template v-for="(heart, index) in hearts" :key="heart.key">
      <div class="absolute -left-6.5 -top-1 w-fit" :style="heartStyle(heart.x, heart.y)">
        <SvgaPlayer v-if="isAnimated(index)" :name="CP_SEAT_HEART_SVGA" width="auto" height="40px" />
        <img
          v-else-if="stillUrl"
          :src="stillUrl"
          alt=""
          class="size-full object-contain"
          decoding="async"
        >
      </div>
    </template>
  </div>
</template>
