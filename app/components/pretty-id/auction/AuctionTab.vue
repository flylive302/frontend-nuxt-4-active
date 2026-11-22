<script setup lang="ts">
/**
 * Rare Auction tab: decides between the locked state (below the auction level)
 * and the live board. A small placeholder shows until `me` — level and rules —
 * has loaded, so the locked state never flashes for an unlocked user.
 */
import { usePrettyIdStore } from '~/stores/prettyId'

// Composables
const store = usePrettyIdStore()

// State
const rules = computed(() => store.me?.rules ?? null)
const isLocked = computed(() => store.me !== null && store.me.level < store.me.rules.min_level_auction)
</script>

<template>
  <p v-if="rules === null" class="pid-empty" role="status">Loading…</p>

  <PrettyIdLocked v-else-if="isLocked" :required-level="rules.min_level_auction" context="auction" />

  <PrettyIdAuctionBoard v-else :rules="rules" />
</template>
