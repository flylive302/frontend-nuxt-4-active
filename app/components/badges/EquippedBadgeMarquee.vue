<script setup lang="ts">
import type { EquippedBadge } from '~/types/progression/badge'

type SlottedBadge = { slot_position: number; badge_id: number; image_url: string }

const props = defineProps<{
  equippedBadges: EquippedBadge[]
}>()

const sorted = computed<SlottedBadge[]>(() =>
  props.equippedBadges
    .filter((b): b is SlottedBadge => b.image_url !== null)
    .sort((a, b) => a.slot_position - b.slot_position)
)

const shouldMarquee = computed(() => sorted.value.length > 3)
</script>

<template>
  <div v-if="sorted.length" class="overflow-hidden flex justify-center items-center">
    <div :class="[{ 'badge-marquee-track': shouldMarquee }]">
      <img
        v-for="badge in sorted"
        :key="`a-${badge.badge_id}`"
        :src="badge.image_url"
        class="size-6 shrink-0"
        alt=""
      >
    </div>
  </div>
</template>

<style scoped>
.badge-marquee-track {
  display: flex;
  width: max-content;
  align-items: center;
  justify-content: center;
  animation: badge-marquee-scroll 16s linear infinite;
}

@keyframes badge-marquee-scroll {
  0% { transform: translateX(0); }
  25% { transform: translateX(-110%); }
  75% { transform: translateX(110%); }
  100% { transform: translateX(0); }
}
</style>
