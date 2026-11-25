<script setup lang="ts">
/**
 * The tier switch: one chip per level reward ("6-digit · Lv 17" / "4-digit ·
 * Lv 34"). The levels come from the server's `me`, never from literals here.
 * Emits `select` — the parent decides what switching means.
 */
import type { PrettyIdTier, PrettyIdTierState } from '~/types/pretty-id'

// ========================================
// Config
// ========================================

defineProps<{
  tiers: PrettyIdTierState[]
  active: PrettyIdTier
}>()

const emit = defineEmits<{
  select: [tier: PrettyIdTier]
}>()
</script>

<template>
  <div class="mt-1.5 mb-0.5 flex flex-wrap justify-center gap-1.5" role="group" aria-label="Pretty ID level">
    <PrettyIdChip
      v-for="state in tiers"
      :key="state.tier"
      :active="active === state.tier"
      @click="emit('select', state.tier)"
    >
      {{ state.tier }}-digit · Lv {{ state.required_level }}
    </PrettyIdChip>
  </div>
</template>
