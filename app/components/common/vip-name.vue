<script setup lang="ts">
// ========================================
// Props
// ========================================

const props = defineProps<{
  name: string
  vip?: number | null
}>()

// ========================================
// State
// ========================================

const rootRef = ref<HTMLElement | null>(null)

// ========================================
// Composables
// ========================================

const { color, active, hostStyle, glintStyle } = useVipGlint(() => props.vip, rootRef)
</script>

<!-- No whitespace between the name and the glint (tags close against the
     text): a space there would become a text node and widen the base text
     relative to its copy. -->
<template>
  <span
    ref="rootRef"
    class="vip-name"
    :class="{ 'vip-name--vip': color }"
    :style="hostStyle"
  >{{ name }}<span
    v-if="active"
    class="vip-glint"
    :style="glintStyle"
    aria-hidden="true"
  ><span class="vip-glint__copy">{{ name }}</span></span></span>
</template>
