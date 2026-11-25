<script setup lang="ts">
/**
 * "Confirm claim" dialog: the picked number, its category and that it is
 * Permanent — no price, nothing else. Open while `claimTarget` is set.
 * Mounted once by <PrettyIdShell>.
 */
import { PRETTY_ID_CATEGORY_LABEL } from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdItem } from '~/types/pretty-id'

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
const view = computed<PrettyIdItem | null>(previous => store.claimTarget ?? previous ?? null)

const categoryLabel = computed(() => (view.value ? PRETTY_ID_CATEGORY_LABEL[view.value.category] : ''))
</script>

<template>
  <PrettyIdModal :open="store.claimTarget !== null" title="Confirm claim" @close="closeClaim">
    <div v-if="view" class="text-center">
      <span class="pid-num pid-gold whitespace-nowrap text-[50px]">{{ view.signature }}</span>
      <p class="pid-body pid-small pid-muted">{{ categoryLabel }} pattern</p>

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
