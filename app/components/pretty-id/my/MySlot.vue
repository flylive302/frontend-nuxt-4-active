<script setup lang="ts">
/**
 * One level-reward slot on the My ID tab (6-digit at Lv 17, 4-digit at Lv 34).
 *
 *  - unclaimed → one row: a "Claim" button when unlocked, else the level that unlocks it.
 *  - claimed → the crowned badge, the token count, and the change cooldown with a
 *    "Change" button. The button stays enabled on purpose: the parent's change
 *    action explains a refusal (no tokens, cooldown) with a toast, which reads
 *    better than a dead button.
 *
 * Intent only: it emits `claim` / `change` and the parent decides what they mean.
 */
import { PRETTY_ID_SLOT_LABEL } from '~/constants/pretty-id'
import type { PrettyIdLength, PrettyIdSlot, PrettyIdSlotKey } from '~/types/pretty-id'

const props = defineProps<{
  entry: PrettyIdSlot
}>()

const emit = defineEmits<{
  claim: [key: PrettyIdSlotKey]
  change: [key: PrettyIdSlotKey]
}>()

// Constants
const BADGE_WIDTH = 'min(300px, 86%)'
/** Number size on the big badge, in px — the 4-digit ID is shorter, so it can be larger. */
const BADGE_NUMBER_SIZE: Record<PrettyIdLength, number> = { 4: 30, 6: 26 }

// Composables
const { now } = usePrettyIdClock()

// State
const label = computed(() => PRETTY_ID_SLOT_LABEL[props.entry.key])

/** The cooldown end while it is still in the future (server clock), else `null`. */
const cooldownTo = computed<string | null>(() => {
  const next = props.entry.next_change_at
  return next !== null && Date.parse(next) > now.value ? next : null
})
</script>

<template>
  <PrettyIdRow v-if="entry.id === null">
    <!-- Wraps instead of truncating: the row art leaves little room beside the button. -->
    <span class="pid-body pid-small min-w-0 flex-1 leading-snug">{{ label }}: not claimed</span>
    <PrettyIdButton v-if="entry.unlocked" size="sm" @click="emit('claim', entry.key)">Claim</PrettyIdButton>
    <span v-else class="pid-small pid-muted">Lv {{ entry.required_level }}</span>
  </PrettyIdRow>

  <div v-else>
    <PrettyIdBadge
      :id="entry.id"
      :width="BADGE_WIDTH"
      :font-size="BADGE_NUMBER_SIZE[entry.length]"
      class="mx-auto my-2.5"
    />

    <div class="pid-body pid-small flex items-center justify-between gap-2 px-1.5">
      <span>{{ label }}</span>
      <span>Tokens: <b class="pid-num pid-gold">{{ entry.change_tokens }}</b></span>
    </div>

    <div class="pid-body pid-small flex items-center justify-between gap-2 px-1.5 pt-1 pb-2">
      <span v-if="cooldownTo">Next change in <PrettyIdCountdown :to="cooldownTo" /></span>
      <span v-else>Change available</span>
      <PrettyIdButton size="sm" @click="emit('change', entry.key)">Change</PrettyIdButton>
    </div>
  </div>
</template>
