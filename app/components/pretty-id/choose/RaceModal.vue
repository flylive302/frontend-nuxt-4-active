<script setup lang="ts">
/**
 * "ID taken" dialog: shown when the ID the user was confirming got claimed by
 * someone else first. Offers look-alike free IDs to pick instead. Open while
 * `raceConflict` is set. Mounted once by <PrettyIdShell>.
 */
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdRaceConflict } from '~/types/pretty-id'

// ========================================
// State
// ========================================

const store = usePrettyIdStore()
const { pickId, closeRace } = usePrettyIdClaimActions()

/**
 * The last open conflict. Picking a suggestion clears `raceConflict` while the
 * dialog is still fading out — rendering from the live store would blank it.
 */
const conflict = computed<PrettyIdRaceConflict | null>(previous => store.raceConflict ?? previous ?? null)
</script>

<template>
  <PrettyIdModal :open="store.raceConflict !== null" title="ID taken" @close="closeRace">
    <div v-if="conflict" class="text-center">
      <p class="pid-body">
        Sorry, <b class="pid-num pid-gold">{{ conflict.id }}</b> was just taken by another user while you were confirming.
      </p>
      <p class="pid-body pid-small pid-muted my-2">Try a similar ID:</p>

      <div v-if="conflict.suggestions.length > 0" class="pid-card-grid">
        <PrettyIdNumberCard
          v-for="suggestion in conflict.suggestions"
          :id="suggestion.id"
          :key="suggestion.id"
          @pick="pickId"
        />
      </div>
      <p v-else class="pid-empty">No close matches free.</p>

      <div class="mt-3">
        <PrettyIdButton size="sm" @click="closeRace">Close</PrettyIdButton>
      </div>
    </div>
  </PrettyIdModal>
</template>
