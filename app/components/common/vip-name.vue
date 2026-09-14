<script setup lang="ts">
// ========================================
// Props
// ========================================

const props = withDefaults(defineProps<{
  name: string
  vip?: number | null
  /** Animated highlight sweep. Opt-in: keep off in lists/seats (many names). */
  shine?: boolean
  /** Pause the shine (e.g. while scrolled out of view). */
  paused?: boolean
}>(), {
  vip: undefined,
  shine: false,
  paused: false,
})

// ========================================
// Composables
// ========================================

const { vipNameColor } = useVipNameColor()

// Computed, not a snapshot: `vip` changes live (vip.updated socket → patchVip).
const color = computed(() => vipNameColor(props.vip))
</script>

<template>
  <span
    class="vip-name"
    :class="{ 'vip-name--shine': shine && color }"
    :style="{
      '--vip-color': color || undefined,
      animationPlayState: paused ? 'paused' : 'running',
    }"
  >{{ name }}</span>
</template>
