<script setup lang="ts">
/**
 * LuckyGiftFly — one fixed full-screen canvas that draws every lucky fly.
 *
 * INTENT only: owns the <canvas>, its size, and the requestAnimationFrame
 * loop. All motion lives in `services/luckyFlyRenderer.ts`; where a fly goes
 * is decided in `useLuckyFly`. The loop runs only while there is work, so an
 * idle room costs nothing.
 */
import {
  LUCKY_FLY_DURATION_MS,
  LUCKY_FLY_FOLD_ACTIVE_THRESHOLD,
  LUCKY_FLY_FOLD_QUEUED_ENTRIES,
  LUCKY_FLY_MAX_AGE_MS,
  LUCKY_FLY_MAX_DPR,
  LUCKY_FLY_MAX_SCALE,
  LUCKY_FLY_MAX_STREAM_MS,
  LUCKY_FLY_PATH_JITTER_PX,
  LUCKY_FLY_SLOW_FRAME_MS,
  LUCKY_FLY_SLOW_FRAMES_TO_FOLD,
  LUCKY_FLY_STAGGER_MS,
  LUCKY_FLY_THUMBNAIL_SIZE,
} from "~/constants/gift";
import { LUCKY_ANIMATION } from "~/constants/lucky-animation";
import { LuckyFlyRenderer } from "~/services/luckyFlyRenderer";
import { giftThumbnailSrc } from "~/utils/imagekit";

const canvasRef = ref<HTMLCanvasElement | null>(null);
const { attachRenderer, detachRenderer, invalidateSeatPositions } = useLuckyFly();

let renderer: LuckyFlyRenderer | null = null;
let frameId = 0;

// ========================================
// Helpers
// ========================================

/**
 * Largest size a fly is ever drawn at, in device pixels.
 *
 * `giftThumbnailSrc` serves a 256px-wide variant (shared with seats, chat and
 * member lists, so it is already cached), but a fly peaks at
 * `LUCKY_FLY_THUMBNAIL_SIZE × LUCKY_FLY_MAX_SCALE` CSS px. Drawing the 256px
 * source directly made every `drawImage` a downscale — once per fly, per
 * frame, and a burst runs dozens of flies off the SAME thumbnail.
 */
const FLY_BITMAP_PX = Math.ceil(
  LUCKY_FLY_THUMBNAIL_SIZE * LUCKY_FLY_MAX_SCALE * LUCKY_FLY_MAX_DPR,
);

/**
 * Main-thread loader: a plain <img> needs no CORS headers to be drawn.
 *
 * Resampled once into an `ImageBitmap` at the exact peak draw size, so each
 * frame's `drawImage` is a near 1:1 blit. Falls back to the raw element where
 * `createImageBitmap` resize options are unavailable.
 */
async function loadThumbnail(url: string): Promise<CanvasImageSource> {
  const img = new Image();
  img.decoding = "async";
  img.src = giftThumbnailSrc(url);
  await img.decode();

  if (typeof createImageBitmap !== "function") return img;
  try {
    return await createImageBitmap(img, {
      resizeWidth: FLY_BITMAP_PX,
      resizeHeight: FLY_BITMAP_PX,
      resizeQuality: "high",
    });
  } catch {
    return img;
  }
}

function frame(now: number): void {
  frameId = 0;
  if (!renderer) return;
  if (renderer.tick(now)) frameId = requestAnimationFrame(frame);
}

/**
 * (Re)start the loop — idempotent while a frame is already scheduled.
 *
 * Sizes the canvas first: `tick` draws against the renderer's stored
 * dimensions, so the deferred allocation must land before the first frame.
 */
function wakeAndFit(): void {
  fitToViewport();
  if (frameId === 0) frameId = requestAnimationFrame(frame);
}

/** Last size the backing store was allocated at, in CSS px. */
let sizedWidth = 0;
let sizedHeight = 0;

function fitToViewport(): void {
  if (!renderer) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (width === sizedWidth && height === sizedHeight) return;

  const dpr = Math.min(window.devicePixelRatio || 1, LUCKY_FLY_MAX_DPR);
  renderer.resize(width, height, dpr);
  sizedWidth = width;
  sizedHeight = height;
  invalidateSeatPositions();
}

/**
 * `resize` handler.
 *
 * Opening the chat composer raises the soft keyboard, which fires `resize`
 * with a shorter viewport. Re-allocating the backing store there wipes the
 * canvas mid-animation and costs a full-viewport allocation on the phones
 * least able to afford it — and the fixed canvas still covers the screen, so
 * nothing needs to change. Only width and growth are acted on.
 */
function onViewportResize(): void {
  // Never sized — no fly has been queued yet, so leave the allocation to the
  // first `wakeAndFit`. A resize is not a reason to start paying for it.
  if (sizedWidth === 0) return;

  const keyboardLikely = window.innerWidth === sizedWidth && window.innerHeight < sizedHeight;
  if (keyboardLikely) {
    // Seat boxes still move under a raised keyboard — the cached geometry
    // must go even though the canvas does not.
    invalidateSeatPositions();
    return;
  }
  fitToViewport();
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  const ctx = canvasRef.value?.getContext("2d");
  if (!ctx) return;
  renderer = new LuckyFlyRenderer({
    ctx,
    loadImage: loadThumbnail,
    thumbnailSize: LUCKY_FLY_THUMBNAIL_SIZE,
    durationMs: LUCKY_FLY_DURATION_MS,
    holdMs: LUCKY_ANIMATION.centerHoldDuration,
    easing: LUCKY_ANIMATION.flyEasing,
    staggerMs: LUCKY_FLY_STAGGER_MS,
    maxStreamMs: LUCKY_FLY_MAX_STREAM_MS,
    jitterPx: LUCKY_FLY_PATH_JITTER_PX,
    maxAgeMs: LUCKY_FLY_MAX_AGE_MS,
    slowFrameMs: LUCKY_FLY_SLOW_FRAME_MS,
    slowFramesToFold: LUCKY_FLY_SLOW_FRAMES_TO_FOLD,
    foldActiveThreshold: LUCKY_FLY_FOLD_ACTIVE_THRESHOLD,
    foldQueuedEntries: LUCKY_FLY_FOLD_QUEUED_ENTRIES,
  });
  // Sized on the first fly, not here: a room that never sees a lucky gift
  // never allocates a full-viewport backing store. The component still mounts
  // and registers, so no first event is lost.
  window.addEventListener("resize", onViewportResize);
  attachRenderer(renderer, wakeAndFit);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", onViewportResize);
  if (frameId !== 0) cancelAnimationFrame(frameId);
  frameId = 0;
  detachRenderer();
  // `destroy` (not `clear`) — the decoded thumbnails are ImageBitmaps and hold
  // real memory until closed.
  renderer?.destroy();
  renderer = null;
  sizedWidth = 0;
  sizedHeight = 0;
});
</script>

<template>
  <canvas ref="canvasRef" class="lucky-fly-canvas" aria-hidden="true" />
</template>

<style scoped>
.lucky-fly-canvas {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  /* Below LuckyMultiplierFloat (50), LuckySenderBands (55) and
     LuckyCashbackCenter (60): the cashback win must read on top of the stream. */
  z-index: 49;
  pointer-events: none;
}
</style>
