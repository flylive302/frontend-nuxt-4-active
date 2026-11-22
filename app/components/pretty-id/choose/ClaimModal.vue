<script setup lang="ts">
/**
 * "Confirm claim" / "Confirm change" dialog: the picked ID, its pattern and what
 * the claim gives (reward or one change token, permanence, the change cooldown).
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
  /** Replacing the slot's current ID (costs a token) rather than a first claim. */
  isChange: boolean
}

// ========================================
// State
// ========================================

const store = usePrettyIdStore()
const { closeClaim, confirmClaim } = usePrettyIdClaimActions()

/**
 * The last open target. `claimTarget` and `changeSlot` both reset the moment a
 * claim succeeds, while the dialog is still fading out — rendering from the live
 * store would blank the number and flip the title mid-close.
 */
const view = computed<ClaimView | null>((previous) => {
  const id = store.claimTarget
  if (id === null) return previous ?? null
  const slot = prettyIdSlotKeyForLength(id.length)
  return { id, slot, isChange: slot !== null && store.changeSlot === slot }
})

const title = computed(() => (view.value?.isChange ? 'Confirm change' : 'Confirm claim'))
const tierLabel = computed(() => (view.value ? PRETTY_ID_TIER_LABEL[classifyPrettyId(view.value.id)] : ''))

const rewardLevel = computed(() => {
  const slot = view.value?.slot
  return slot ? (store.me?.slots[slot].required_level ?? null) : null
})
const rewardText = computed(() => {
  if (view.value?.isChange) return '1 token'
  return rewardLevel.value === null ? 'Free' : `Lv ${rewardLevel.value} · free`
})

const cooldownHours = computed(() => store.me?.rules.change_cooldown_hours ?? null)
const changesText = computed(() => (cooldownHours.value === null ? '1 token' : `1 token / ${cooldownHours.value}h`))
</script>

<template>
  <PrettyIdModal :open="store.claimTarget !== null" :title="title" @close="closeClaim">
    <div v-if="view" class="text-center">
      <span class="pid-num pid-gold whitespace-nowrap text-[50px]">{{ view.id }}</span>
      <p class="pid-body pid-small pid-muted">{{ tierLabel }} pattern</p>

      <PrettyIdRow>
        <span class="pid-row__grow pid-body pid-small text-left">{{ view.isChange ? 'Change' : 'Reward' }}</span>
        <span class="pid-body pid-small">{{ rewardText }}</span>
      </PrettyIdRow>
      <PrettyIdRow>
        <span class="pid-row__grow pid-body pid-small text-left">Valid</span>
        <span class="pid-body pid-small">Permanent</span>
      </PrettyIdRow>
      <PrettyIdRow>
        <span class="pid-row__grow pid-body pid-small text-left">Changes</span>
        <span class="pid-body pid-small">{{ changesText }}</span>
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
