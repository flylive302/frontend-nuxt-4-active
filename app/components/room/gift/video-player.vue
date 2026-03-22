<script setup lang="ts">
/**
 * Gift Video Player
 *
 * Plays video gift assets with proper ended event handling.
 * Uses cached Blob URLs from preloader for instant playback.
 * NO loop attribute - video plays once and emits 'ended'.
 * Uses programmatic play() with AbortError handling to prevent
 * console errors when the component is destroyed mid-play.
 */
import * as giftAssetCache from '~/services/giftAssetCache';
import { createLogger } from '~/utils/logger';

const log = createLogger('[VideoPlayer]');

const props = defineProps<{
  src: string;
}>();

const emit = defineEmits<{
  ended: [];
  error: [error: Event];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);

/** Guard flag — prevents play/error callbacks after component unmount */
let isDestroyed = false;

// Reactive video source - starts with sync cache lookup, updates after preload
const resolvedSrc = ref<string | null>(null);

/**
 * Get the video source - use cached Blob URL if available, else original URL
 */
const videoSrc = computed(() => resolvedSrc.value ?? props.src);

/**
 * Auto-detect MIME type from URL extension
 */
const videoType = computed(() => {
  const url = props.src.toLowerCase();
  if (url.includes('.webm')) return 'video/webm';
  if (url.includes('.mp4')) return 'video/mp4';
  if (url.includes('.mov')) return 'video/quicktime';
  if (url.includes('.ogg')) return 'video/ogg';
  // Default fallback
  return 'video/webm';
});

/**
 * Safely call play() on the video element.
 * Catches AbortError which fires when the element is removed from DOM mid-play
 * (e.g. when `:key` changes force a component recreation).
 */
function safePlay(): void {
  if (isDestroyed || !videoRef.value) return;

  videoRef.value.play().catch((err: unknown) => {
    // AbortError is expected when element is removed from DOM — suppress it
    if (err instanceof DOMException && err.name === 'AbortError') return;
    log.error('Video play failed:', props.src, err);
  });
}

// On mount, try to get from cache or preload, then play
onMounted(async () => {
  // First try sync L1 cache
  const syncUrl = giftAssetCache.getCachedVideoUrlSync(props.src);
  if (syncUrl !== props.src) {
    resolvedSrc.value = syncUrl;
    log.debug('Video from L1 cache:', props.src);
  } else {
    // If not in L1, preload async (L2 cache / network)
    try {
      const url = await giftAssetCache.preloadVideo(props.src);
      if (isDestroyed) return;
      resolvedSrc.value = url;
      log.debug('Video preloaded:', props.src);
    } catch {
      if (isDestroyed) return;
      // Use original URL as fallback
      resolvedSrc.value = props.src;
      log.warn('Video preload failed, using original URL:', props.src);
    }
  }

  // Wait for Vue to apply the resolved src to the DOM, then play
  await nextTick();
  safePlay();
});

// Pause before unmount to prevent AbortError from pending play() promises
onBeforeUnmount(() => {
  isDestroyed = true;
  if (videoRef.value) {
    videoRef.value.pause();
    videoRef.value.removeAttribute('src');
    videoRef.value.load(); // Release media resources
  }
});

/**
 * Restart video from the beginning (for combo mode)
 */
function restart() {
  if (videoRef.value) {
    videoRef.value.currentTime = 0;
    safePlay();
  }
}

/**
 * Handle video error
 */
function handleError(event: Event) {
  if (isDestroyed) return;
  log.error('Error loading video:', props.src);
  emit('error', event);
  // Fallback: emit ended to prevent modal from hanging
  emit('ended');
}

// Expose restart method for parent component
defineExpose({ restart });
</script>

<template>
  <video
    ref="videoRef"
    class="w-full h-auto object-contain"
    preload="auto"
    playsinline
    @ended="emit('ended')"
    @error="handleError"
  >
    <source :src="videoSrc" :type="videoType">
  </video>
</template>
