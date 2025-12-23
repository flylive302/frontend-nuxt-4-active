<script setup lang="ts">
/**
 * Gift Video Player
 *
 * Plays video gift assets with proper ended event handling.
 * Uses cached Blob URLs from preloader for instant playback.
 * NO loop attribute - video plays once and emits 'ended'.
 */
import { useGiftAssetCache } from '~/composables/useGiftAssetCache';

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
const { getCachedVideoUrl } = useGiftAssetCache();

/**
 * Get the video source - use cached Blob URL if available
 */
const videoSrc = computed(() => getCachedVideoUrl(props.src));

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
  return 'video/mp4';
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
  console.error('[VideoPlayer] Error loading video:', props.src);
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
    class="min-w-screen object-contain"
    :autoplay="autoplay"
    preload="auto"
    playsinline
    @ended="emit('ended')"
    @error="handleError"
  >
    <source :src="videoSrc" :type="videoType">
  </video>
</template>


