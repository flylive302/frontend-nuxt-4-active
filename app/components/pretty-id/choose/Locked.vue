<script setup lang="ts">
/**
 * The locked state of the Choose tab: the padlock animation,
 * "Pretty ID Locked", and a "Your level" panel showing how far the user is from
 * `requiredLevel`. Copy differs by what is locked (`context`). Reads the user's
 * level from the store.
 */
import { PRETTY_ID_ASSETS } from '~/constants/assets'
import { usePrettyIdStore } from '~/stores/prettyId'

// ========================================
// Config
// ========================================

const props = defineProps<{
  /** Level at which this feature unlocks. */
  requiredLevel: number
  context: LockedContext
}>()

// ========================================
// Constants
// ========================================

const PERCENT = 100

const LINE: Record<LockedContext, (level: number) => string> = {
  'six-digit': level => `Reach Lv ${level} to unlock your 6-digit Pretty ID`,
  'four-digit': level => `Reach Lv ${level} to unlock a 4-digit Pretty ID`,
}

const HINT: Record<LockedContext, string | null> = {
  // Quotes the Lv 34 threshold, which is server-owned — built from `me` below.
  'six-digit': null,
  'four-digit': 'Elite 4-digit IDs come with the diamond crown',
}

/** Six-digit hint while `me` has not loaded, so there is no Lv 34 threshold to quote yet. */
const HINT_ELITE_FALLBACK = 'Higher levels unlock 4-digit elite IDs'

// ========================================
// Types
// ========================================

/** What is locked: the 6-digit list or the 4-digit list. */
type LockedContext = 'six-digit' | 'four-digit'

// ========================================
// State
// ========================================

const store = usePrettyIdStore()
const { showLevelHelp } = usePrettyIdClaimActions()

const eliteLevel = computed(() => store.me?.slots.lv34.required_level ?? null)

const line = computed(() => LINE[props.context](props.requiredLevel))

const hint = computed(() => {
  const fixed = HINT[props.context]
  if (fixed !== null) return fixed
  return eliteLevel.value === null ? HINT_ELITE_FALLBACK : `Lv ${eliteLevel.value} unlocks 4-digit elite IDs`
})

const progressPercent = computed(() => {
  if (props.requiredLevel <= 0) return PERCENT
  return Math.min(PERCENT, (store.level / props.requiredLevel) * PERCENT)
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
        <span class="pid-num pid-gold text-[26px]">{{ store.level }} / {{ requiredLevel }}</span>
      </p>
      <div
        class="pid-bar mx-1 my-2.5"
        role="progressbar"
        aria-label="Level progress"
        aria-valuemin="0"
        :aria-valuemax="requiredLevel"
        :aria-valuenow="store.level"
      >
        <i :style="{ width: `${progressPercent}%` }" />
      </div>
      <p class="pid-body pid-small pid-muted text-center">{{ hint }}</p>
    </PrettyIdPanel>

    <div class="text-center">
      <PrettyIdButton @click="showLevelHelp">How to level up</PrettyIdButton>
    </div>
  </div>
</template>
