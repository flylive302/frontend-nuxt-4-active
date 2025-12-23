<script setup lang="ts">
/**
 * Gift Playback Modal
 *
 * Full-screen modal that plays gift animations.
 * Routes to correct player based on asset type.
 * Includes safety timeout to prevent stuck modals.
 */
import { GIFT_PLAYBACK_TIMEOUT_MS } from '~/constants/gift';

const authStore = useAuthStore();
const giftStore = useGiftStore();
const { combo } = useGiftSending();

// Player refs for combo restart
const videoPlayerRef = ref<{ restart: () => void } | null>(null);
const svgaPlayerRef = ref<{ restart: () => void } | null>(null);
const staticDisplayRef = ref<{ restart: () => void } | null>(null);

// Current playback from store
const currentPlayback = computed(() => giftStore.currentPlayback);
const isOpen = computed(() => giftStore.isPlaying);

// Check if the current user is the sender of the gift
const isSender = computed(() => authStore.user?.id === currentPlayback.value?.senderId);

// Combo button visibility (independent of animation state)
const isComboButtonVisible = ref(false);

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
    console.warn('[GiftPlayback] Timeout reached - force closing modal');
    handleComplete();
  }, GIFT_PLAYBACK_TIMEOUT_MS);
}

// Show combo button when playback starts (only for sender)
// Also start the safety timeout
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
// This triggers player restart when receiver gets a combo gift
watch(
  () => currentPlayback.value?.timestamp,
  (newTimestamp, oldTimestamp) => {
    // Only restart if both timestamps exist (not initial load) and differ
    if (newTimestamp && oldTimestamp && newTimestamp !== oldTimestamp) {
      const assetType = currentPlayback.value?.gift.asset_type;
      if (assetType === 'video') {
        videoPlayerRef.value?.restart();
      } else if (assetType === 'svga') {
        svgaPlayerRef.value?.restart();
      } else if (assetType === 'static') {
        staticDisplayRef.value?.restart();
      }
      // Reset combo button visibility on restart (only for sender)
      if (isSender.value) {
        isComboButtonVisible.value = true;
      }
      // Reset timeout for combo
      startPlaybackTimeout();
    }
  }
);

/**
 * Handle playback completion
 */
function handleComplete() {
  clearPlaybackTimeout();
  giftStore.onPlaybackComplete();
}

// Cleanup timeout on unmount
onBeforeUnmount(clearPlaybackTimeout);

/**
 * Handle combo button click
 */
async function handleCombo() {
  const success = await combo();

  if (success) {
    // Restart the current player
    const assetType = currentPlayback.value?.gift.asset_type;
    if (assetType === 'video') {
      videoPlayerRef.value?.restart();
    } else if (assetType === 'svga') {
      svgaPlayerRef.value?.restart();
    } else if (assetType === 'static') {
      staticDisplayRef.value?.restart();
    }
  }
}

/**
 * Handle combo timeout (combo button expires)
 */
function handleComboTimeout() {
  // Hide combo button, let animation finish naturally
  isComboButtonVisible.value = false;
}
</script>

<template>
  <UModal
    :open="isOpen"
    fullscreen
    :dismissible="false"
    :overlay="false"
    :ui="{
      content: 'bg-transparent border-none rounded-none',
    }"
    title="Gift Playing Model"
    description="Gift Playing Model"
  >
    <template #content>
      <div class="size-full flex items-center justify-center">
        <template v-if="currentPlayback">
          <!-- Video Player -->
          <RoomGiftVideoPlayer
            v-if="currentPlayback.gift.asset_type === 'video'"
            ref="videoPlayerRef"
            :src="currentPlayback.gift.asset_url"
            @ended="handleComplete"
          />

          <!-- SVGA Player -->
          <RoomGiftSvgaPlayer
            v-else-if="currentPlayback.gift.asset_type === 'svga'"
            ref="svgaPlayerRef"
            :name="currentPlayback.gift.asset_url"
            @complete="handleComplete"
          />

          <!-- Static Image -->
          <RoomGiftStaticDisplay
            v-else
            ref="staticDisplayRef"
            :src="currentPlayback.gift.asset_url"
            @timeout="handleComplete"
          />
        </template>
      </div>
    </template>
  </UModal>

  <!-- Combo Button (only visible during playback and before timeout) -->
  <RoomGiftComboButton
    v-if="isOpen && isComboButtonVisible"
    @click="handleCombo"
    @timeout="handleComboTimeout"
  />
</template>
