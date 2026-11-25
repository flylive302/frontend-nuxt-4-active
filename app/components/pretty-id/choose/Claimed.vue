<script setup lang="ts">
/**
 * The already-claimed state of a tier: one free claim per tier, ever, so the
 * tier shows the number the user took instead of a list.
 */
import { PRETTY_ID_CATEGORY_LABEL } from '~/constants/pretty-id'
import type { PrettyIdClaimed } from '~/types/pretty-id'

// ========================================
// Config
// ========================================

const props = defineProps<{
  claimed: PrettyIdClaimed
}>()

// ========================================
// State
// ========================================

const { viewInMyProps } = usePrettyIdClaimActions()

const categoryLabel = computed(() => PRETTY_ID_CATEGORY_LABEL[props.claimed.category])
/** "5 2 0 5 2 0" — the characters stand apart, as in the celebration. */
const spacedNumber = computed(() => props.claimed.signature.split('').join(' '))
</script>

<template>
  <div>
    <PrettyIdPanel title="Already claimed">
      <div class="text-center" role="img" :aria-label="`Your Pretty ID ${claimed.signature}`">
        <span class="pid-num pid-gold text-[34px]" aria-hidden="true">{{ spacedNumber }}</span>
        <p class="pid-body pid-small mt-1.5">{{ categoryLabel }} pattern · Permanent</p>
      </div>
      <p class="pid-body pid-small pid-muted mt-2 text-center">One free Pretty ID per level — this one is yours.</p>
    </PrettyIdPanel>

    <div class="text-center">
      <PrettyIdButton @click="viewInMyProps">View in My Props</PrettyIdButton>
    </div>
  </div>
</template>
