<script setup lang="ts">
/**
 * "Confirm claim" dialog: the picked ID, its pattern and what the claim gives
 * (the level reward and its permanence).
 * Open while `claimTarget` is set. Mounted once by <PrettyIdShell>.
 */
import { PRETTY_ID_TIER_LABEL } from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdSlotKey } from '~/types/pretty-id'
import { classifyPrettyId } from '~/utils/pretty-id-rules'
import { prettyIdSlotKeyForLength } from '~/utils/pretty-id-slots'

// ========================================
// Types
// ========================================

/** What the dialog shows — captured while the dialog is open. */
interface ClaimView {
  id: string
  slot: PrettyIdSlotKey | null
}

// ========================================
// State
// ========================================

const store = usePrettyIdStore()
const { closeClaim, confirmClaim } = usePrettyIdClaimActions()

/**
 * The last open target. `claimTarget` resets the moment a claim succeeds, while
 * the dialog is still fading out — rendering from the live store would blank
 * the number mid-close.
 */
const view = computed<ClaimView | null>((previous) => {
  const id = store.claimTarget
  if (id === null) return previous ?? null
  return { id, slot: prettyIdSlotKeyForLength(id.length) }
})

const tierLabel = computed(() => (view.value ? PRETTY_ID_TIER_LABEL[classifyPrettyId(view.value.id)] : ''))

const rewardLevel = computed(() => {
  const slot = view.value?.slot
  return slot ? (store.me?.slots[slot].required_level ?? null) : null
})
const rewardText = computed(() => (rewardLevel.value === null ? 'Free' : `Lv ${rewardLevel.value} · free`))
</script>

<template>
  <PrettyIdModal :open="store.claimTarget !== null" title="Confirm claim" @close="closeClaim">
    <div v-if="view" class="text-center">
      <span class="pid-num pid-gold whitespace-nowrap text-[50px]">{{ view.id }}</span>
      <p class="pid-body pid-small pid-muted">{{ tierLabel }} pattern</p>

      <PrettyIdRow>
        <span class="pid-row__grow pid-body pid-small text-left">Reward</span>
        <span class="pid-body pid-small">{{ rewardText }}</span>
      </PrettyIdRow>
      <PrettyIdRow>
        <span class="pid-row__grow pid-body pid-small text-left">Valid</span>
        <span class="pid-body pid-small">Permanent</span>
      </PrettyIdRow>

      <div class="mt-2.5 flex items-center justify-center gap-2.5">
        <PrettyIdButton size="sm" :disabled="store.isClaiming" @click="closeClaim">Cancel</PrettyIdButton>
        <PrettyIdButton size="sm" :disabled="store.isClaiming" @click="confirmClaim">
          {{ store.isClaiming ? 'Confirming…' : 'Confirm' }}
        </PrettyIdButton>
      </div>
    </div>
  </PrettyIdModal>
</template>
