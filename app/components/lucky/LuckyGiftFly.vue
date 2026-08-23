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
  LUCKY_FLY_MAX_DPR,
  LUCKY_FLY_MAX_STREAM_MS,
  LUCKY_FLY_PATH_JITTER_PX,
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

/** Main-thread loader: a plain <img> needs no CORS headers to be drawn. */
function loadThumbnail(url: string): Promise<CanvasImageSource> {
  const img = new Image();
  img.decoding = "async";
  img.src = giftThumbnailSrc(url);
  return img.decode().then(() => img);
}

function frame(now: number): void {
  frameId = 0;
  if (!renderer) return;
  if (renderer.tick(now)) frameId = requestAnimationFrame(frame);
}

/** (Re)start the loop — idempotent while a frame is already scheduled. */
function wake(): void {
  if (frameId === 0) frameId = requestAnimationFrame(frame);
}

function fitToViewport(): void {
  if (!renderer) return;
  const dpr = Math.min(window.devicePixelRatio || 1, LUCKY_FLY_MAX_DPR);
  renderer.resize(window.innerWidth, window.innerHeight, dpr);
  invalidateSeatPositions();
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
  });
  fitToViewport();
  window.addEventListener("resize", fitToViewport);
  attachRenderer(renderer, wake);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", fitToViewport);
  if (frameId !== 0) cancelAnimationFrame(frameId);
  frameId = 0;
  detachRenderer();
  renderer?.clear();
  renderer = null;
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
