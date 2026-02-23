<script setup lang="ts">
/**
 * Gift Playback Modal
 *
 * Full-screen modal that plays gift animations.
 * Click to minimize into a draggable pip, click again to restore.
 * Routes to correct player based on asset type.
 * Includes safety timeout to prevent stuck modals.
 */
import { GIFT_PLAYBACK_TIMEOUT_MS } from '~/constants/gift';
import { createLogger } from '~/utils/logger';
import { resolveVideoUrl } from '~/utils/platform';
import { useBoundedDrag } from '~/composables/shared/useBoundedDrag';

const log = createLogger('[GiftPlayback]');
const authStore = useAuthStore();
const giftStore = useGiftStore();
const { combo } = useGiftSending();

// ========================================
// Player Refs
// ========================================

const videoPlayerRef = ref<{ restart: () => void } | null>(null);
const svgaPlayerRef = ref<{ restart: () => void } | null>(null);
const staticDisplayRef = ref<{ restart: () => void } | null>(null);

// ========================================
// State
// ========================================

const currentPlayback = computed(() => giftStore.currentPlayback);
const isOpen = computed(() => giftStore.isPlaying);
const isSender = computed(() => authStore.user?.id === currentPlayback.value?.senderId);
const isComboButtonVisible = ref(false);
const isMinimized = ref(false);
const isPositioned = ref(false);

// ========================================
// Draggable (active only when minimized)
// ========================================

const { dragEl, position, setPosition, winW, winH, isDragging } = useBoundedDrag();

/**
 * Toggle between fullscreen and minimized states
 */
function toggleMinimize() {
  isMinimized.value = !isMinimized.value;

  if (isMinimized.value) {
    isPositioned.value = false;
    // Set position directly — bypass clamp until element is measured
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

// Set initial position for testing
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

// ========================================
// Playback Timeout (Safety Net)
// ========================================

let playbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Clear the playback timeout
 */
function clearPlaybackTimeout() {
  if (playbackTimeoutId) {
    clearTimeout(playbackTimeoutId);
    playbackTimeoutId = null;
  }
}

/**
 * Start the playback timeout - force completes if animation stalls
 */
function startPlaybackTimeout() {
  clearPlaybackTimeout();
  playbackTimeoutId = setTimeout(() => {
    log.warn('Timeout reached - force closing modal');
    handleComplete();
  }, GIFT_PLAYBACK_TIMEOUT_MS);
}

// ========================================
// Watchers
// ========================================

// Reset state when playback starts/stops
watch(isOpen, (open) => {
  if (open) {
    startPlaybackTimeout();
    if (isSender.value) {
      isComboButtonVisible.value = true;
    }
  } else {
    clearPlaybackTimeout();
    isComboButtonVisible.value = false;
  }
});

// Watch for combo restarts from other users (timestamp changes)
watch(
  () => currentPlayback.value?.timestamp,
  (newTimestamp, oldTimestamp) => {
    if (newTimestamp && oldTimestamp && newTimestamp !== oldTimestamp) {
      const assetType = currentPlayback.value?.gift.asset_type;
      if (assetType === 'video') {
        videoPlayerRef.value?.restart();
      } else if (assetType === 'svga') {
        svgaPlayerRef.value?.restart();
      } else if (assetType === 'image') {
        staticDisplayRef.value?.restart();
      }
      if (isSender.value) {
        isComboButtonVisible.value = true;
      }
      startPlaybackTimeout();
    }
  }
);

// ========================================
// Handlers
// ========================================

/**
 * Handle playback completion
 */
function handleComplete() {
  clearPlaybackTimeout();
  giftStore.onPlaybackComplete();
}

/**
 * Handle combo button click
 */
async function handleCombo() {
  const success = await combo();

  if (success) {
    const assetType = currentPlayback.value?.gift.asset_type;
    if (assetType === 'video') {
      videoPlayerRef.value?.restart();
    } else if (assetType === 'svga') {
      svgaPlayerRef.value?.restart();
    } else if (assetType === 'image') {
      staticDisplayRef.value?.restart();
    }
  }
}

/**
 * Handle combo timeout (combo button expires)
 */
function handleComboTimeout() {
  isComboButtonVisible.value = false;
}

// Cleanup timeout on unmount
onBeforeUnmount(clearPlaybackTimeout);
</script>

<template>
  <div
    v-if="isOpen"
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
      isDragging ? '!transition-none' : ''
    ]"
    @click="toggleMinimize"
  >
    <template v-if="currentPlayback">
      <!-- Video Player -->
      <RoomGiftVideoPlayer v-if="currentPlayback.gift.asset_type === 'video'" ref="videoPlayerRef" class="w-full"
        :src="resolveVideoUrl(currentPlayback.gift.animation_url ?? '')" @ended="handleComplete" />

      <!-- SVGA Player -->
      <RoomGiftSvgaPlayer v-else-if="currentPlayback.gift.asset_type === 'svga'" ref="svgaPlayerRef" class="w-full"
        :name="currentPlayback.gift.animation_url ?? ''" @complete="handleComplete" />

      <!-- Static Image -->
      <RoomGiftStaticDisplay v-else ref="staticDisplayRef" class="w-full" :src="currentPlayback.gift.thumbnail_url"
        @timeout="handleComplete" />
    </template>
  </div>

  <!-- Combo Button (only visible during playback and before timeout) -->
  <RoomGiftComboButton
    v-if="isOpen && isComboButtonVisible"
    @click="handleCombo"
    @timeout="handleComboTimeout"
  />
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
