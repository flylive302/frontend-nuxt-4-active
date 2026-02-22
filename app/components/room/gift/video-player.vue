<script setup lang="ts">
/**
 * Gift Video Player
 *
 * Plays video gift assets with proper ended event handling.
 * Uses cached Blob URLs from preloader for instant playback.
 * NO loop attribute - video plays once and emits 'ended'.
 */
import { useGiftAssetCache } from '~/composables/gift/useGiftAssetCache';
import { createLogger } from '~/utils/logger';

const log = createLogger('[VideoPlayer]');

const props = withDefaults(
  defineProps<{
    src: string;
    autoplay?: boolean;
  }>(),
  {
    autoplay: true,
  }
);

const emit = defineEmits<{
  ended: [];
  error: [error: Event];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const { getCachedVideoUrlSync, preloadVideo } = useGiftAssetCache();

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

// On mount, try to get from cache or preload
onMounted(async () => {
  // First try sync L1 cache
  const syncUrl = getCachedVideoUrlSync(props.src);
  if (syncUrl !== props.src) {
    resolvedSrc.value = syncUrl;
    log.debug('Video from L1 cache:', props.src);
    return;
  }
  
  // If not in L1, preload async (L2 cache / network)
  try {
    const url = await preloadVideo(props.src);
    resolvedSrc.value = url;
    log.debug('Video preloaded:', props.src);
  } catch {
    // Use original URL as fallback
    resolvedSrc.value = props.src;
    log.warn('Video preload failed, using original URL:', props.src);
  }
});

/**
 * Restart video from the beginning (for combo mode)
 */
function restart() {
  if (videoRef.value) {
    videoRef.value.currentTime = 0;
    videoRef.value.play();
  }
}

/**
 * Handle video error
 */
function handleError(event: Event) {
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
    :autoplay="autoplay"
    preload="auto"
    playsinline
    @ended="emit('ended')"
    @error="handleError"
  >
    <source :src="videoSrc" :type="videoType">
  </video>
</template>


