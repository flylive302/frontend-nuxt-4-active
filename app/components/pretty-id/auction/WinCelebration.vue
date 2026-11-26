<script setup lang="ts">
/**
 * App-wide congratulations for a Rare Auction the viewer won: the unlock
 * animation, "Congratulations!", the Rare ID letter-spaced, "Yours for N days",
 * "View in My Props" and "Done". Confetti and the mark-seen call are fired by
 * `usePrettyIdUnseenWins`. Mounted once by the global shell, which has no
 * Pretty ID theme root, so it brings its own (the stylesheet loads with it —
 * the shell mounts this component lazily, only when there is a win to show).
 */
import { PRETTY_ID_ASSETS } from '~/constants/assets'
import { usePrettyIdAuctionStore } from '~/stores/prettyIdAuction'
import { prettyIdRareWinView } from '~/utils/pretty-id-auction'

// ========================================
// Composables
// ========================================

const store = usePrettyIdAuctionStore()
const { finishWinCelebration, viewWinInMyProps } = usePrettyIdUnseenWins()

// ========================================
// State
// ========================================

const titleId = useId()

const win = computed(() => store.winCelebration)
const view = computed(() => (win.value === null ? null : prettyIdRareWinView(win.value)))
</script>

<template>
  <PrettyIdTheme>
    <PrettyIdCelebrationLayer :open="view !== null" :labelledby="titleId" @close="finishWinCelebration">
      <template v-if="view">
        <div class="pid-accent">
          <PrettyIdAnimation :src="PRETTY_ID_ASSETS.unlockLv34Svga" />
        </div>

        <h2 :id="titleId" class="pid-disp pid-gold text-[26px]">{{ view.title }}</h2>
        <p class="pid-body pid-small my-1.5">{{ view.subline }}</p>

        <PrettyIdPanel title="Your new Rare ID">
          <div role="img" :aria-label="view.idLabel">
            <span class="pid-num pid-gold text-[32px]" aria-hidden="true">{{ view.spacedId }}</span>
          </div>
          <p class="pid-body pid-small mt-2">{{ view.keepLine }}</p>
        </PrettyIdPanel>
      </template>

      <template #actions>
        <PrettyIdButton @click="viewWinInMyProps">View in My Props</PrettyIdButton>
        <PrettyIdButton @click="finishWinCelebration">Done</PrettyIdButton>
      </template>
    </PrettyIdCelebrationLayer>
  </PrettyIdTheme>
</template>
