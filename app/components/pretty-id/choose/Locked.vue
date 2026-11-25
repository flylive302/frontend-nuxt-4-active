<script setup lang="ts">
/**
 * The locked state of a tier on the Choose tab: the padlock animation,
 * "Pretty ID Locked", and a "Your level" panel showing how far the user is
 * from the tier's `required_level` (e.g. "12 / 17"), with a way to level up.
 */
import { PRETTY_ID_ASSETS } from '~/constants/assets'
import { PRETTY_ID_ELITE_TIER } from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdTier } from '~/types/pretty-id'

// ========================================
// Config
// ========================================

const props = defineProps<{
  tier: PrettyIdTier
  /** Level at which this tier unlocks. */
  requiredLevel: number
}>()

// ========================================
// Constants
// ========================================

const PERCENT = 100

/** Hint under the bar for the elite tier itself (nothing higher to point at). */
const HINT_ELITE = 'Elite 4-character IDs come with the diamond crown'
/** Hint while the elite threshold is not known. */
const HINT_ELITE_FALLBACK = 'Higher levels unlock 4-character elite IDs'

// ========================================
// State
// ========================================

const store = usePrettyIdStore()
const { openLevelHelp } = usePrettyIdClaimActions()

const line = computed(() => `Reach Lv ${props.requiredLevel} to unlock your ${props.tier}-character Pretty ID`)

const eliteLevel = computed(() => store.me?.tiers.find(state => state.tier === PRETTY_ID_ELITE_TIER)?.required_level ?? null)

const hint = computed(() => {
  if (props.tier === PRETTY_ID_ELITE_TIER) return HINT_ELITE
  return eliteLevel.value === null ? HINT_ELITE_FALLBACK : `Lv ${eliteLevel.value} unlocks 4-character elite IDs`
})

const progressPercent = computed(() => {
  if (props.requiredLevel <= 0) return PERCENT
  return Math.min(PERCENT, (store.wealthLevel / props.requiredLevel) * PERCENT)
})
</script>

<template>
  <div>
    <!-- `.pid-accent` caps itself at 380px, and its own CSS beats a utility — so the
         300px cap sits on a wrapper. -->
    <div class="mx-auto max-w-[300px]">
      <div class="pid-accent">
        <PrettyIdAnimation :src="PRETTY_ID_ASSETS.lockedSvga" />
      </div>
    </div>

    <div class="text-center">
      <h2 class="pid-disp pid-gold text-[22px]">Pretty ID Locked</h2>
      <p class="pid-body pid-small mt-1.5">{{ line }}</p>
    </div>

    <PrettyIdPanel title="Your level">
      <p class="text-center">
        <span class="pid-num pid-gold text-[26px]">{{ store.wealthLevel }} / {{ requiredLevel }}</span>
      </p>
      <div
        class="pid-bar mx-1 my-2.5"
        role="progressbar"
        aria-label="Level progress"
        aria-valuemin="0"
        :aria-valuemax="requiredLevel"
        :aria-valuenow="store.wealthLevel"
      >
        <i :style="{ width: `${progressPercent}%` }" />
      </div>
      <p class="pid-body pid-small pid-muted text-center">{{ hint }}</p>
    </PrettyIdPanel>

    <div class="text-center">
      <PrettyIdButton @click="openLevelHelp">How to level up</PrettyIdButton>
    </div>
  </div>
</template>
