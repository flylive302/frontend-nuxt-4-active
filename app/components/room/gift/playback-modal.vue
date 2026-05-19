<script setup lang="ts">
/**
 * Gift Playback Modal
 *
 * Thin presentation component for gift animations.
 * Click to minimize into a draggable pip, click again to restore.
 * All business logic lives in useGiftPlayback composable.
 */
import { resolveVideoUrl } from '~/utils/platform';
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';


const {
  currentPlayback,
  isPlaying,

  isMinimized,
  videoPlayerRef,
  svgaPlayerRef,
  staticDisplayRef,
  vapPlayerRef,
  handleComplete,
  handleCombo,

  toggleMinimize,
} = useGiftPlayback();

// ========================================
// Draggable (active only when minimized)
// ========================================

const { dragEl, position, winW, winH, isDragging } = useBoundedDrag();
const isPositioned = ref(false);

/**
 * Wrap toggleMinimize to handle drag positioning
 */
function onToggleMinimize() {
  toggleMinimize();

  if (isMinimized.value) {
    isPositioned.value = false;
    nextTick(() => {
      nextTick(() => {
        position.value = {
          x: winW.value - 80 - 16,
          y: winH.value - 240,
        };
        isPositioned.value = true;
      });
    });
  } else {
    isPositioned.value = false;
  }
}

// Set initial position
onMounted(() => {
  nextTick(() => {
    nextTick(() => {
      position.value = {
        x: winW.value - 80 - 16,
        y: winH.value - 240,
      };
      isPositioned.value = true;
    });
  });
});


</script>

<template>
  <div
    v-if="isPlaying"
    ref="dragEl"
    :style="isMinimized && isPositioned
      ? `transform: translate3d(${position.x}px, ${position.y}px, 0); width: 80px; height: 120px;`
      : ''
    "
    :class="[
      'gift-playback-container flex items-center justify-center',
      isMinimized
        ? 'gift-playback--minimized bg-black/50'
        : 'gift-playback--fullscreen bg-white/20',
      isDragging ? 'transition-none!' : ''
    ]"
    @click="onToggleMinimize"
  >
    <template v-if="currentPlayback">
      <!-- Video Player -->
      <RoomGiftVideoPlayer v-if="currentPlayback.gift.asset_type === 'video'" :key="`video-${currentPlayback.id}`" ref="videoPlayerRef" class="w-full"
        :src="resolveVideoUrl(currentPlayback.gift.animation_url ?? '')" @ended="handleComplete" />

      <!-- SVGA Player -->
      <RoomGiftSvgaPlayer v-else-if="currentPlayback.gift.asset_type === 'svga'" :key="`svga-${currentPlayback.id}`" ref="svgaPlayerRef" class="w-full"
        :name="currentPlayback.gift.animation_url ?? ''" @complete="handleComplete" />

      <!-- VAP Player (MP4 + alpha via WebGL) -->
      <VapPlayer v-else-if="currentPlayback.gift.asset_type === 'vap'" :key="`vap-${currentPlayback.id}`" ref="vapPlayerRef" class="w-full"
        :name="currentPlayback.gift.animation_url ?? ''" :loop="1" @complete="handleComplete" />

      <!-- Static Image -->
      <RoomGiftStaticDisplay v-else :key="`static-${currentPlayback.id}`" ref="staticDisplayRef" class="w-full" :src="currentPlayback.gift.thumbnail_url"
        @timeout="handleComplete" />
    </template>
  </div>


</template>

<style scoped>
.gift-playback-container {
  position: fixed;
  z-index: 9999;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Fullscreen state */
.gift-playback--fullscreen {
  inset: 0;
  background: hsl(var(--color-info) / 0.1);
}

/* Minimized draggable pip */
.gift-playback--minimized {
  top: 0;
  left: 0;
  margin: 0;
  border-radius: 0.5rem;
  overflow: hidden;
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  touch-action: none;
  cursor: move;
}
</style>
