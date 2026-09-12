<script setup lang="ts">
/**
 * Gift Playback Modal
 *
 * Thin presentation component for gift animations.
 * Click to minimize into a draggable pip, click again to restore.
 * All business logic lives in useGiftPlayback composable.
 */
import { resolveVideoUrl } from '~/utils/platform';
import { giftThumbnailSrc } from '~/utils/imagekit';
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';


const {
  currentPlayback,
  isPlaying,
  isMinimized,
  currentSides,
  handleComplete,
  handleProgress,
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
      <RoomGiftVideoPlayer
v-if="currentPlayback.gift.asset_type === 'video'" :key="`video-${currentPlayback.id}`" class="w-full"
        :src="resolveVideoUrl(currentPlayback.gift.animation_url ?? '')"
        :poster="giftThumbnailSrc(currentPlayback.gift.thumbnail_url)" @ended="handleComplete"
        @progress="handleProgress" />

      <!-- SVGA Player -->
      <RoomGiftSvgaPlayer
v-else-if="currentPlayback.gift.asset_type === 'svga'" :key="`svga-${currentPlayback.id}`" class="w-full"
        :name="currentPlayback.gift.animation_url ?? ''" @complete="handleComplete"
        @progress="handleProgress" />

      <!-- VAP Player (MP4 + alpha via WebGL) -->
      <VapPlayer
v-else-if="currentPlayback.gift.asset_type === 'vap'" :key="`vap-${currentPlayback.id}`" class="w-full"
        :name="currentPlayback.gift.animation_url ?? ''" :loop="1" :muted="false" @complete="handleComplete"
        @progress="handleProgress" />

      <!-- Static Image -->
      <RoomGiftStaticDisplay
v-else :key="`static-${currentPlayback.id}`" class="w-full" :src="currentPlayback.gift.thumbnail_url"
        @timeout="handleComplete" />
    </template>
  </div>

  <!-- Side lanes (gift-backlog-and-lag 06): lighter gifts (image/svga — see
       laneFor() in the gift store), up to SIDE_LANES concurrent small
       players. Sibling of the center container (not nested inside it) so it
       never sits under the center's fullscreen click-catcher, and keeps
       rendering even while the center lane is idle. -->
  <div class="gift-side-lanes flex flex-col gap-2">
    <div v-for="(item, index) in currentSides" :key="index" class="gift-side-lane">
      <template v-if="item">
        <div class="gift-side-lane__inner relative">
          <!-- SVGA Player — only when the slot decided to play the real animation -->
          <RoomGiftSvgaPlayer
            v-if="item.playSvga" :key="`side-svga-${item.id}`" class="w-full h-full"
            :name="item.gift.animation_url ?? ''" @complete="handleComplete('side', index)"
            @progress="handleProgress('side', index)" />

          <!-- Static thumbnail — default for side lanes (no video/vap, ever) -->
          <RoomGiftStaticDisplay
            v-else :key="`side-static-${item.id}`" class="w-full h-full" :src="item.gift.thumbnail_url"
            @timeout="handleComplete('side', index)" />

          <span v-if="(item.repeats ?? 1) > 1" class="gift-side-lane__badge">×{{ item.repeats }}</span>
        </div>
      </template>
    </div>
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

/*
 * Side lanes (gift-backlog-and-lag 06): fixed column of SIDE_LANES small
 * players, pinned to the top-right so it never overlaps the center player
 * (which is either fullscreen or a bottom-right pip). Mobile-first: small
 * enough (~64px) to stay out of the way on a phone screen.
 */
.gift-side-lanes {
  position: fixed;
  top: max(env(safe-area-inset-top, 0px), 8px);
  right: 8px;
  z-index: 9998;
  pointer-events: none;
}

.gift-side-lane {
  width: 64px;
  height: 64px;
}

.gift-side-lane__inner {
  width: 100%;
  height: 100%;
  border-radius: 0.5rem;
  overflow: hidden;
  background: hsl(var(--color-info) / 0.15);
  box-shadow: 0 4px 6px -4px rgb(0 0 0 / 0.2);
}

.gift-side-lane__badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  padding: 0 4px;
  border-radius: 0.25rem;
  background: rgb(0 0 0 / 0.6);
  color: white;
  font-size: 10px;
  line-height: 1.4;
  font-weight: 600;
}
</style>
