<script setup lang="ts">
/**
 * MarqueeRow - generic horizontal marquee for a row of inline content.
 *
 * Renders the default slot once when it fits, and twice (seamless
 * `translateX(-50%)` loop) only when it actually overflows the container.
 * Content-agnostic: badges, icons, flags — anything laid out in a row.
 *
 * ⚠️ The CALLER must width-bound this component (e.g. `max-w-48`). Overflow is
 * detected with `scrollWidth > clientWidth`; an unbounded container grows to fit
 * its content, so the check can never be true and the row silently never scrolls.
 *
 * Only the FIRST copy is measured, so the measurement never depends on whether
 * the duplicate is currently mounted — content that shrinks back below the
 * container width correctly stops scrolling. The inter-copy gap is a MARGIN
 * (excluded from `scrollWidth`) for the same reason, and is applied to both
 * copies identically so the -50% translation lands exactly on the seam.
 */
import { MARQUEE_ROW_DURATION_SECONDS, MARQUEE_ROW_RESIZE_DEBOUNCE_MS } from '~/constants/marquee'

const props = withDefaults(
  defineProps<{
    /**
     * Pause the scrolling animation. Purely visual — `animation-play-state`,
     * no layout/appearance change while paused/resumed.
     */
    paused?: boolean
    /** Seconds for one full loop. */
    durationSeconds?: number
  }>(),
  {
    paused: false,
    durationSeconds: MARQUEE_ROW_DURATION_SECONDS,
  }
)

const containerRef = ref<HTMLElement | null>(null)
const copyRef = ref<HTMLElement | null>(null)
const isOverflowing = ref(false)

function checkOverflow(): void {
  if (!containerRef.value || !copyRef.value) return
  isOverflowing.value = copyRef.value.scrollWidth > containerRef.value.clientWidth
}

onMounted(() => {
  const ro = new ResizeObserver(useDebounceFn(checkOverflow, MARQUEE_ROW_RESIZE_DEBOUNCE_MS))
  if (containerRef.value) ro.observe(containerRef.value)
  if (copyRef.value) ro.observe(copyRef.value)
  // Images inside the slot land after paint; measure on the next frame.
  nextTick(() => requestAnimationFrame(checkOverflow))
  onUnmounted(() => ro.disconnect())
})
</script>

<template>
  <div ref="containerRef" class="overflow-hidden">
    <div
      class="flex w-max"
      :class="{ 'marquee-track': isOverflowing }"
      :style="{
        animationDuration: `${props.durationSeconds}s`,
        animationPlayState: props.paused ? 'paused' : 'running',
      }"
    >
      <div ref="copyRef" class="marquee-copy flex items-center shrink-0">
        <slot />
      </div>
      <!-- Duplicate copy for the seamless loop — only when the marquee is active -->
      <div v-if="isOverflowing" aria-hidden="true" class="marquee-copy flex items-center shrink-0">
        <slot />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Margin, not padding: excluded from `scrollWidth`, so it never feeds back into
   the overflow measurement above. */
.marquee-copy {
  margin-right: 3rem;
}

.marquee-track {
  animation-name: marquee-scroll;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

@keyframes marquee-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>
