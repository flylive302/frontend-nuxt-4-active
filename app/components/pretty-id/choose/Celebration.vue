<script setup lang="ts">
/**
 * Full-screen celebration after a claim succeeds: the tier's unlock animation
 * (the confetti burst is fired by the claim action), the new number
 * letter-spaced in a panel, "View in My Props" and "Done" (closes it, stays on
 * the Choose tab). It REPLACES the screen (a fixed layer over the page, see
 * <PrettyIdCelebrationLayer>) rather than stacking a dialog on it. Shown while
 * `celebration` is set. Mounted once by <PrettyIdShell>, inside the theme root
 * (so the tokens and helper classes apply) — which is why it is not teleported.
 */
import { PRETTY_ID_ASSETS } from '~/constants/assets'
import { PRETTY_ID_ELITE_TIER } from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'

// ========================================
// State
// ========================================

const store = usePrettyIdStore()
const { finishCelebration, viewInMyProps } = usePrettyIdClaimActions()

const titleId = useId()

const isOpen = computed(() => store.celebration !== null)
const isElite = computed(() => store.celebration?.tier === PRETTY_ID_ELITE_TIER)

const animationSrc = computed(() =>
  isElite.value ? PRETTY_ID_ASSETS.unlockLv34Svga : PRETTY_ID_ASSETS.unlockLv17Svga,
)
/** "Elite Lv 34" — the level comes from `me`, never a literal. */
const eliteLevel = computed(() => store.me?.tiers.find(state => state.tier === PRETTY_ID_ELITE_TIER)?.required_level ?? null)
const title = computed(() => {
  if (!isElite.value) return 'Congratulations!'
  return eliteLevel.value === null ? 'Elite' : `Elite Lv ${eliteLevel.value}`
})
const subline = computed(() => (isElite.value ? '4-character Pretty ID · Diamond Crown' : '6-character Pretty ID unlocked'))
const panelTitle = computed(() => (isElite.value ? 'Elite ID' : 'Your new ID'))
const celebratedId = computed(() => store.celebration?.signature ?? '')
/** "5 2 0 5 2 0" — the characters stand apart, as in the design. */
const spacedId = computed(() => celebratedId.value.split('').join(' '))
</script>

<template>
  <PrettyIdCelebrationLayer :open="isOpen" :labelledby="titleId" @close="finishCelebration">
    <div class="pid-accent">
      <PrettyIdAnimation :src="animationSrc" />
    </div>

    <h2 :id="titleId" class="pid-disp pid-gold" :class="isElite ? 'text-[26px]' : 'text-[22px]'">{{ title }}</h2>
    <p class="pid-body pid-small my-1.5">{{ subline }}</p>

    <PrettyIdPanel :title="panelTitle">
      <div role="img" :aria-label="`Pretty ID ${celebratedId}`">
        <span
          class="pid-num pid-gold"
          :class="isElite ? 'text-[40px]' : 'text-[32px]'"
          aria-hidden="true"
        >{{ spacedId }}</span>
      </div>
    </PrettyIdPanel>

    <template #actions>
      <PrettyIdButton @click="viewInMyProps">View in My Props</PrettyIdButton>
      <PrettyIdButton @click="finishCelebration">Done</PrettyIdButton>
    </template>
  </PrettyIdCelebrationLayer>
</template>
