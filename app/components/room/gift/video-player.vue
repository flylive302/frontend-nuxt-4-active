<script setup lang="ts">
/**
 * Gift Video Player
 *
 * Plays video gift assets with proper ended event handling.
 * NO loop attribute - video plays once and emits 'ended'.
 */

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
    playsinline
    @ended="emit('ended')"
    @error="handleError"
  >
    <source :src="src" :type="videoType">
  </video>
</template>

