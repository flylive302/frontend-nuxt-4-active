<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  delay?: string
  textClass?: string
  vip?: number | null
  /** Animated highlight sweep over the VIP colour. Opt-in (profile headers). */
  shine?: boolean
  /**
   * Pause the scrolling animation (e.g. while the header is scrolled out of
   * view). Purely visual — `animation-play-state`, no layout/appearance
   * change while paused/resumed.
   */
  paused?: boolean
}>(), {
  delay: undefined,
  textClass: undefined,
  vip: undefined,
  shine: false,
  paused: false,
})

const containerRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const isOverflowing = ref(false)

function checkOverflow() {
  if (!containerRef.value || !trackRef.value) return
  // Temporarily measure just the single text's natural width
  isOverflowing.value = trackRef.value.scrollWidth > containerRef.value.clientWidth
}

let ro: ResizeObserver | null = null
let rafHandle: number | null = null

function scheduleCheck() {
  if (rafHandle !== null) cancelAnimationFrame(rafHandle)
  rafHandle = requestAnimationFrame(() => {
    rafHandle = null
    checkOverflow()
  })
}

onMounted(() => {
  ro = new ResizeObserver(useDebounceFn(checkOverflow, 80))
  if (containerRef.value) ro.observe(containerRef.value)
  if (trackRef.value) ro.observe(trackRef.value)
  nextTick(scheduleCheck)
})

// Registered at setup scope (not inside onMounted) so an `async` mounted
// callback can never silently drop the cleanup.
onUnmounted(() => {
  ro?.disconnect()
  ro = null
  if (rafHandle !== null) cancelAnimationFrame(rafHandle)
  rafHandle = null
})

watch(() => props.name, async () => {
  // Reset first so the track collapses to its natural width before we measure.
  // Without this, a shrinking name still overflows the now-collapsed container
  // and isOverflowing stays true indefinitely.
  isOverflowing.value = false
  await nextTick()
  scheduleCheck()
})

// Computed, not a setup-time snapshot: the parent's `vip` prop changes live
// (vip.updated socket → authStore.patchVip, or the profile page's syncUser()).
const { vipNameColor } = useVipNameColor()
const colorFullName = computed(() => vipNameColor(props.vip))
const nameClass = computed(() => ['vip-name', { 'vip-name--shine': props.shine && !!colorFullName.value }])
const nameStyle = computed(() => ({
  '--vip-color': colorFullName.value || undefined,
  animationPlayState: props.paused ? 'paused' : 'running',
}))
</script>

<template>
  <div ref="containerRef" class="overflow-hidden">
    <div
        ref="trackRef"
        class="whitespace-nowrap"
        :class="[{ 'marquee-track': isOverflowing }]"
        :style="{
          ...(isOverflowing && delay ? { animationDelay: delay } : {}),
          animationPlayState: paused ? 'paused' : 'running',
        }"
    >
      <span
          :class="[textClass, nameClass]"
          :style="nameStyle"
      >
        {{ name }}
      </span>
      <!-- Duplicate for seamless loop, gap via padding -->
      <span
          v-if="isOverflowing"
          :class="[textClass, nameClass]"
          :style="nameStyle"
          aria-hidden="true"
          class="pl-12"
      >
        {{ name }}
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

@keyframes marquee-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>