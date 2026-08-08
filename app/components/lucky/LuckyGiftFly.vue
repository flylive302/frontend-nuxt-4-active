<script setup lang="ts">
/**
 * LuckyGiftFly — Renders flying thumbnail animations for lucky gifts.
 *
 * Each fly item is an <img> element animated via Web Animations API.
 * Uses only GPU-composited properties (transform, opacity) for peak performance.
 * Multiple animations can run concurrently without interference.
 */
import type { LuckyFlyItem } from "~/composables/lucky/useLuckyFly";
import {
  LUCKY_FLY_DURATION_MS,
  LUCKY_FLY_THUMBNAIL_SIZE,
} from "~/constants/gift";
import { LUCKY_ANIMATION } from "~/constants/lucky-animation";
import { giftThumbnailSrc } from "~/utils/imagekit";

const { flyItems, removeFlyItem } = useLuckyFly();

// ========================================
// Animation
// ========================================

/** Guard against Vue re-firing v-for :ref callbacks on reactivity updates */
const animatedIds = new Set<string>();

/**
 * Animate a fly item element through 5 keyframes:
 * appear → pop → center → land → vanish.
 *
 * Called via template ref callback when element mounts.
 */
function animateFlyItem(el: Element | null, item: LuckyFlyItem): void {
  if (!(el instanceof HTMLElement)) return;
  if (animatedIds.has(item.id)) return;
  animatedIds.add(item.id);

  const { startPos, centerPos, endPos } = item;

  // Flight phases keep the original 0/.15/.5/.85/1 pacing over
  // LUCKY_FLY_DURATION_MS; the configurable center hold is inserted at the
  // midpoint so the gift visibly pauses before fanning out. Offsets are the
  // original absolute times re-scaled onto the extended total duration.
  const hold = LUCKY_ANIMATION.centerHoldDuration;
  const total = LUCKY_FLY_DURATION_MS + hold;
  const at = (fraction: number, extra = 0): number =>
    (fraction * LUCKY_FLY_DURATION_MS + extra) / total;

  const keyframes: Keyframe[] = [
    // Phase 1: Appear at sender (invisible, small)
    {
      transform: `translate(${startPos.x}px, ${startPos.y}px) scale(0.2)`,
      opacity: 0,
      offset: 0,
    },
    // Phase 2: Pop at sender (visible, slightly oversized)
    {
      transform: `translate(${startPos.x}px, ${startPos.y}px) scale(1.1)`,
      opacity: 1,
      offset: at(0.15),
    },
    // Phase 3: Arrive at center (largest)
    {
      transform: `translate(${centerPos.x}px, ${centerPos.y}px) scale(1.3)`,
      opacity: 1,
      offset: at(0.5),
    },
    // Phase 3b: Hold at center (configurable pause before the fan-out)
    {
      transform: `translate(${centerPos.x}px, ${centerPos.y}px) scale(1.3)`,
      opacity: 1,
      offset: at(0.5, hold),
    },
    // Phase 4: Land at receiver (normal size)
    {
      transform: `translate(${endPos.x}px, ${endPos.y}px) scale(0.9)`,
      opacity: 1,
      offset: at(0.85, hold),
    },
    // Phase 5: Vanish at receiver (small, invisible)
    {
      transform: `translate(${endPos.x}px, ${endPos.y}px) scale(0.2)`,
      opacity: 0,
      offset: 1,
    },
  ];

  const animation = el.animate(keyframes, {
    duration: total,
    easing: LUCKY_ANIMATION.flyEasing,
    fill: "forwards",
  });

  animation.onfinish = () => {
    animatedIds.delete(item.id);
    removeFlyItem(item.id);
  };
}
</script>

<template>
  <div
    v-for="item in flyItems"
    :key="item.id"
    :ref="(el) => animateFlyItem(el as Element, item)"
    class="lucky-fly-item"
  >
    <img
      :src="giftThumbnailSrc(item.thumbnailUrl)"
      :width="LUCKY_FLY_THUMBNAIL_SIZE"
      :height="LUCKY_FLY_THUMBNAIL_SIZE"
      class="size-full object-contain drop-shadow-lg"
      alt=""
      loading="eager"
      decoding="async"
    >
  </div>
</template>

<style scoped>
.lucky-fly-item {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9998;
  pointer-events: none;
  will-change: transform, opacity;
  width: v-bind("`${LUCKY_FLY_THUMBNAIL_SIZE}px`");
  height: v-bind("`${LUCKY_FLY_THUMBNAIL_SIZE}px`");
}
</style>
