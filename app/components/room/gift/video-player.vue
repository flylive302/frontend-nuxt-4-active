<script setup lang="ts">
/**
 * Gift Video Player
 *
 * Plays video gift assets with proper ended event handling.
 * The <video> element is only mounted once the playback URL is fully
 * resolved (L1 blob / L2 Cache Storage / network) — `src` sits directly
 * on the element so the resolved URL is what actually loads.
 * Element stays invisible until the first frame is decoded
 * (requestVideoFrameCallback, fallback `loadeddata`) so the WebView
 * never shows its gray media placeholder.
 * NO loop attribute - video plays once and emits 'ended'.
 * Autoplay: unmuted play() first; on NotAllowedError retry muted;
 * on second failure emit 'ended' immediately so the queue never hangs.
 */
import * as giftAssetCache from '~/services/giftAssetCache';


const props = defineProps<{
  src: string;
  /** Gift thumbnail shown while the video buffers (belt-and-braces with the opacity gate) */
  poster?: string;
}>();

const emit = defineEmits<{
  ended: [];
  error: [error: Event];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);

/** Guard flag — prevents play/error callbacks after component unmount */
let isDestroyed = false;

/** Final playback URL — the <video> is not rendered until this is set */
const resolvedSrc = ref<string | null>(null);

/** Flips true once the first frame is decoded — reveals the element */
const isRevealed = ref(false);

// Resolve the URL before the element exists: sync L1 first (instant for
// preloaded gifts), otherwise async L2/network via the asset cache.
const syncUrl = giftAssetCache.getCachedVideoUrlSync(props.src);
if (syncUrl !== props.src) {
  resolvedSrc.value = syncUrl;
} else {
  giftAssetCache.preloadVideo(props.src)
    .then((url) => {
      if (!isDestroyed) resolvedSrc.value = url;
    })
    .catch(() => {
      if (!isDestroyed) resolvedSrc.value = props.src;
    });
}

/**
 * Safely call play() on the video element.
 * - AbortError (element removed mid-play, e.g. :key remount) is suppressed.
 * - NotAllowedError (autoplay policy) retries muted, mirroring the VAP player.
 * - Any other failure — or a failed muted retry — emits 'ended' immediately
 *   so a stuck item never blocks the serial playback queue.
 */
function safePlay(): void {
  const video = videoRef.value;
  if (isDestroyed || !video) return;

  video.play().catch((err: unknown) => {
    if (isDestroyed) return;
    if (err instanceof DOMException && err.name === 'AbortError') return;

    if (err instanceof DOMException && err.name === 'NotAllowedError' && !video.muted) {
      video.muted = true;
      video.play().catch(() => {
        if (!isDestroyed) emit('ended');
      });
      return;
    }

    emit('ended');
  });
}

// Once the <video> mounts (v-if on resolvedSrc), gate reveal on the first
// decoded frame and start playback.
watch(videoRef, (video) => {
  if (!video || isDestroyed) return;

  const rvfc = video as unknown as {
    requestVideoFrameCallback?: (cb: () => void) => number;
  };
  if (typeof rvfc.requestVideoFrameCallback === 'function') {
    rvfc.requestVideoFrameCallback(() => {
      if (!isDestroyed) isRevealed.value = true;
    });
  } else {
    video.addEventListener(
      'loadeddata',
      () => {
        if (!isDestroyed) isRevealed.value = true;
      },
      { once: true },
    );
  }

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
  emit('error', event);
  // Fallback: emit ended to prevent modal from hanging
  emit('ended');
}

// Expose restart method for parent component
defineExpose({ restart });
</script>

<template>
  <video
    v-if="resolvedSrc"
    ref="videoRef"
    :src="resolvedSrc"
    :poster="poster"
    :class="[
      'w-full h-auto object-contain transition-opacity duration-150',
      isRevealed ? 'opacity-100' : 'opacity-0',
    ]"
    preload="auto"
    playsinline
    disablepictureinpicture
    controlslist="nodownload noplaybackrate"
    @ended="emit('ended')"
    @error="handleError"
  />
</template>
