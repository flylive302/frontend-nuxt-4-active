<script setup lang="ts">
const props = defineProps<{
  name: string
  delay?: string
  textClass?: string
}>()

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
</script>

<template>
  <div ref="containerRef" class="overflow-hidden">
    <div
        ref="trackRef"
        class="whitespace-nowrap"
        :class="[{ 'marquee-track': isOverflowing }]"
        :style="isOverflowing && delay ? { animationDelay: delay } : {}"
    >
      <span :class="textClass">{{ name }}</span>
      <!-- Duplicate for seamless loop, gap via padding -->
      <span v-if="isOverflowing" :class="textClass" aria-hidden="true" class="pl-12">{{ name }}</span>
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