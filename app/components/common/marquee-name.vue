<script setup lang="ts">
const props = withDefaults(defineProps<{
  name: string
  delay?: string
  textClass?: string
  vip?: number
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

onMounted(() => {
  const ro = new ResizeObserver(useDebounceFn(checkOverflow, 80))
  if (containerRef.value) ro.observe(containerRef.value)
  if (trackRef.value) ro.observe(trackRef.value)
  nextTick(() => requestAnimationFrame(checkOverflow))
  onUnmounted(() => ro.disconnect())
})

watch(() => props.name, async () => {
  // Reset first so the track collapses to its natural width before we measure.
  // Without this, a shrinking name still overflows the now-collapsed container
  // and isOverflowing stays true indefinitely.
  isOverflowing.value = false
  await nextTick()
  requestAnimationFrame(checkOverflow)
})

let colorFullName = '';

if (props.vip && props.vip == 3) { colorFullName = '#6b3293'; }
if (props.vip && props.vip == 4) { colorFullName = '#ef9d2a'; }
if (props.vip && props.vip == 5) { colorFullName = '#2d1757'; }
if (props.vip && props.vip == 6) { colorFullName = '#bd731f'; }
if (props.vip && props.vip == 7) { colorFullName = '#00bc6f'; }
if (props.vip && props.vip == 8) { colorFullName = '#098dd9'; }
if (props.vip && props.vip == 9) { colorFullName = '#cd0e8c'; }
if (props.vip && props.vip == 10) { colorFullName = '#7e1e07'; }
if (props.vip && props.vip == 11) { colorFullName = '#43d08a'; }
if (props.vip && props.vip == 12) { colorFullName = '#468a25'; }
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
          :class="textClass"
          :style="{ color: colorFullName }"
      >
        {{ name }}
      </span>
      <!-- Duplicate for seamless loop, gap via padding -->
      <span
          v-if="isOverflowing"
          :class="textClass"
          :style="{ color: colorFullName }"
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