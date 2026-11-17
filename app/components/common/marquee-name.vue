<script setup lang="ts">
// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  name: string
  /** `animation-delay` for the scroll — staggers names in a list. */
  delay?: string
  textClass?: string
  vip?: number | null
}>(), {
  delay: undefined,
  textClass: undefined,
  vip: undefined,
})

// ========================================
// State
// ========================================

const containerRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
/** The name is wider than its container (measured on the single, still copy). */
const isOverflowing = ref(false)

// ========================================
// Composables
// ========================================

const { nameMotionEnabled } = useNameMotion()

/**
 * Scrolling = overflowing AND name motion is on (tier x "Names" switch).
 * Overflowing with motion off stays a single truncated name — no copy, no
 * animation. `isOverflowing` is still measured either way, so flipping the
 * switch on needs no re-measure.
 */
const scrolling = computed(() => isOverflowing.value && nameMotionEnabled.value)

/** Overflowing with motion off: one name, ended with an ellipsis. */
const truncated = computed(() => isOverflowing.value && !nameMotionEnabled.value)

/** Copy indices: a second, aria-hidden copy only while scrolling (seamless loop). */
const copies = computed(() => (scrolling.value ? [0, 1] : [0]))

// Observing the container also while scrolling (not only for VIPs) lets the
// scroll pause off-screen, same as the glint.
const { color, inView, active, still, hostStyle, glintStyle } = useVipGlint(() => props.vip, containerRef, scrolling)

const trackStyle = computed(() => (scrolling.value
  ? { animationDelay: props.delay, animationPlayState: inView.value ? 'running' : 'paused' }
  : undefined))

useSharedResize([containerRef, trackRef], checkOverflow)

// ========================================
// Handlers
// ========================================

function checkOverflow(): void {
  if (!containerRef.value || !trackRef.value) return
  isOverflowing.value = trackRef.value.scrollWidth > containerRef.value.clientWidth
}

// A new name doesn't resize the (block-level) track, so the observer won't
// report it — re-measure explicitly. Collapse first: while overflowing the
// track holds two copies, so a shrunken name would still read as overflowing.
let nameFrame: number | null = null
watch(() => props.name, () => {
  isOverflowing.value = false
  nameFrame ??= requestAnimationFrame(() => {
    nameFrame = null
    checkOverflow()
  })
})

onUnmounted(() => {
  if (nameFrame !== null) cancelAnimationFrame(nameFrame)
})
</script>

<template>
  <div ref="containerRef" class="overflow-hidden">
    <!-- `truncate` only while overflowing with motion off (the name ends in an
         ellipsis). It does not affect the overflow measurement (`scrollWidth`
         is the full content width, ellipsis or not). -->
    <div
      ref="trackRef"
      class="whitespace-nowrap"
      :class="{ 'marquee-track': scrolling, truncate: truncated }"
      :style="trackStyle"
    >
      <!-- No whitespace between the name and the glint (tags close against
           the text): a space would widen the base text relative to its copy. -->
      <span
        v-for="copy in copies"
        :key="copy"
        :class="[textClass, { 'marquee-copy': scrolling }]"
        :aria-hidden="copy > 0 ? 'true' : undefined"
      >
        <!-- A still VIP host is a plain inline span (no glint is mounted, so it
             needs no box): the track's ellipsis can then truncate it, and the
             track's `scrollWidth` still sees the full name. An inline-block
             host with its own overflow clip would hide the overflow from that
             measurement and make a later "Names on" miss the marquee. -->
        <span
          v-if="color"
          class="vip-name--vip"
          :class="[still ? 'inline vip-name--still' : 'inline-block']"
          :style="hostStyle"
        >{{ name }}<span
          v-if="active"
          class="vip-glint"
          :style="glintStyle"
          aria-hidden="true"
        ><span class="vip-glint__copy">{{ name }}</span></span></span>
        <template v-else>{{ name }}</template>
      </span>
    </div>
  </div>
</template>

<style scoped>
.marquee-track {
  display: inline-flex;
  width: max-content;
  animation: marquee-scroll 6s linear infinite;
}

/* The loop gap is a margin on BOTH copies, never padding on the second only:
   the track is then exactly two (copy + gap) units wide, so translateX(-50%)
   lands the second copy precisely where the first started — no jump at the
   seam. */
.marquee-copy {
  margin-right: 3rem;
}

@keyframes marquee-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>
