<script setup lang="ts">
import type { EquippedBadge } from '~/types/progression/badge'

type SlottedBadge = { slot_position: number; badge_id: number; image_url: string }

const props = defineProps<{
  equippedBadges: EquippedBadge[]
}>()

const containerRef = ref<HTMLElement | null>(null)
const trackRef = ref<HTMLElement | null>(null)
const isOverflowing = ref(false)

const sorted = computed<SlottedBadge[]>(() =>
    props.equippedBadges
        .filter((b): b is SlottedBadge => b.image_url !== null)
        .sort((a, b) => a.slot_position - b.slot_position)
)

// Check if the track overflows the container
function checkOverflow() {
  if (!containerRef.value || !trackRef.value) return
  isOverflowing.value = trackRef.value.scrollWidth > containerRef.value.clientWidth
}

onMounted(() => {
  const ro = new ResizeObserver(checkOverflow)
  if (containerRef.value) ro.observe(containerRef.value)
  if (trackRef.value) ro.observe(trackRef.value)
  checkOverflow()
  onUnmounted(() => ro.disconnect())
})

watch(sorted, async () => {
  // Reset before measuring so a shrinking badge list doesn't falsely overflow.
  isOverflowing.value = false
  await nextTick()
  checkOverflow()
})
</script>

<template>
  <div v-if="sorted.length" ref="containerRef" class="overflow-hidden flex items-center">
    <div
        ref="trackRef"
        class="flex items-center gap-1"
        :class="{ 'marquee-track': isOverflowing }"
    >
      <img
          v-for="badge in sorted"
          :key="`a-${badge.badge_id}`"
          :src="badge.image_url"
          class="size-6 shrink-0"
          alt=""
      >
      <!-- Duplicate set for seamless looping — only rendered when marquee is active -->
      <template v-if="isOverflowing">
        <img
            v-for="badge in sorted"
            :key="`b-${badge.badge_id}`"
            :src="badge.image_url"
            class="size-6 shrink-0"
            aria-hidden="true"
            alt=""
        >
      </template>
    </div>
  </div>
</template>

<style scoped>
.marquee-track {
  animation: marquee-scroll 6s linear infinite;
  width: max-content;
}

@keyframes marquee-scroll {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>