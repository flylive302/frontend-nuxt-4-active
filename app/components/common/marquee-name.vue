<script setup lang="ts">
const props = defineProps<{
  name: string
  delay?: string
  textClass?: string
}>()

const containerRef = ref<HTMLElement | null>(null)
const textRef = ref<HTMLElement | null>(null)
const overflowOffset = ref(0)

const shouldMarquee = computed(() => props.name.length > 10)

function measure() {
  if (!containerRef.value || !textRef.value) return
  const delta = textRef.value.scrollWidth - containerRef.value.clientWidth
  overflowOffset.value = delta > 0 ? -delta : 0
}

onMounted(() => {
  nextTick(() => requestAnimationFrame(measure))

  if (containerRef.value) {
    const observer = new ResizeObserver(useDebounceFn(measure, 80))
    observer.observe(containerRef.value)
    onUnmounted(() => observer.disconnect())
  }
})
</script>

<template>
  <div ref="containerRef" class="overflow-hidden">
    <p
      ref="textRef"
      class="whitespace-nowrap"
      :class="[textClass, { 'marquee-text': shouldMarquee }]"
      :style="shouldMarquee ? { '--marquee-offset': `${overflowOffset}px`, ...(delay ? { animationDelay: delay } : {}) } : {}"
    >{{ name }}</p>
  </div>
</template>
