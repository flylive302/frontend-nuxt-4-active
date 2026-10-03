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
const isOverflowing = ref(false)

/** Copy indices: a second, aria-hidden copy only while scrolling (seamless loop). */
const copies = computed(() => (isOverflowing.value ? [0, 1] : [0]))

// ========================================
// Composables
// ========================================

// Observing the container also while overflowing (not only for VIPs) lets the
// scroll pause off-screen, same as the glint.
const { color, inView, active, hostStyle, glintStyle } = useVipGlint(() => props.vip, containerRef, isOverflowing)

const trackStyle = computed(() => (isOverflowing.value
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
    <div
      ref="trackRef"
      class="whitespace-nowrap"
      :class="{ 'marquee-track': isOverflowing }"
      :style="trackStyle"
    >
      <!-- No whitespace between the name and the glint (tags close against
           the text): a space would widen the base text relative to its copy. -->
      <span
        v-for="copy in copies"
        :key="copy"
        :class="[textClass, { 'marquee-copy': isOverflowing }]"
        :aria-hidden="copy > 0 ? 'true' : undefined"
      >
        <span
          v-if="color"
          class="vip-name--vip inline-block"
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
