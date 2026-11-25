<script setup lang="ts">
/**
 * "Just taken" dialog: shown when the number the user was confirming got
 * claimed by someone else first. No look-alikes are offered — the list behind
 * it has already been refreshed. Open while `raceConflict` is set. Mounted once
 * by <PrettyIdShell>.
 */
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdRaceConflict } from '~/types/pretty-id'

// ========================================
// State
// ========================================

const store = usePrettyIdStore()
const { closeRace } = usePrettyIdClaimActions()

/** The last open conflict: rendering from the live store would blank the dialog while it fades out. */
const conflict = computed<PrettyIdRaceConflict | null>(previous => store.raceConflict ?? previous ?? null)
</script>

<template>
  <PrettyIdModal :open="store.raceConflict !== null" title="Just taken" @close="closeRace">
    <div v-if="conflict" class="text-center">
      <p class="pid-body">
        Sorry, <b class="pid-num pid-gold">{{ conflict.signature }}</b> was just taken by another user while you were confirming.
      </p>
      <p class="pid-body pid-small pid-muted my-2">Pick another number from the list.</p>

      <div class="mt-3">
        <PrettyIdButton size="sm" @click="closeRace">Close</PrettyIdButton>
      </div>
    </div>
  </PrettyIdModal>
</template>
