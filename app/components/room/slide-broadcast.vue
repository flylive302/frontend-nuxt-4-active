<script setup lang="ts">
/**
 * Room Slide Broadcast Overlay
 *
 * Non-blocking SVGA overlay that renders one independent player per active
 * slide. Sits above room content (z-60), under the gift modal (z-9999).
 * pointer-events: none so it never intercepts clicks on the UI underneath.
 * Each player self-removes from the store when its SVGA completes.
 */
import { SLIDE_TOP_OFFSET_PX } from '~/constants/room';

const slideStore = useRoomSlideStore();

// No mount-time clear — would race with the self-slide path in joinRoom.
// Stale items are flushed by leaveRoom() (calls slideStore.clearSlides()).

function onSlideComplete(id: string) {
  slideStore.removeSlide(id);
}

// Build the dynamic-elements map for a single slide. Canvas dimensions must
// match the 'test' placeholder layer dimensions in the .svga file.
function makeSlideElements(userName: string): Record<string, HTMLCanvasElement> | undefined {
  if (!import.meta.client) return undefined;
  const c = document.createElement('canvas');
  c.width = 400;
  c.height = 80;
  const ctx = c.getContext('2d')!;
  ctx.font = 'bold 32px Inter, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${userName} is the room`, 200, 40);
  return { test: c };
}
</script>

<template>
  <div
    class="slide-broadcast-layer absolute left-0 right-0 flex justify-center"
    :style="{ top: `${SLIDE_TOP_OFFSET_PX}px` }"
  >
    <div
      v-for="slide in slideStore.activeSlides"
      :key="slide.id"
      class="slide-broadcast-item"
    >
      <SvgaPlayer
        :name="slide.assetUrl"
        :loop="1"
        :dynamic-elements="makeSlideElements(slide.userName)"
        @complete="onSlideComplete(slide.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.slide-broadcast-layer {
  pointer-events: none;
  z-index: 60;
}

.slide-broadcast-item {
  width: min(90vw, 480px);
  height: auto;
}
</style>
