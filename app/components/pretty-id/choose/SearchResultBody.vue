<script setup lang="ts">
/**
 * What goes inside the search-result panel — one of seven variants: nothing
 * searched yet, searching, lookup failed, invalid, auction-only (1–99),
 * available, or taken / reserved (with look-alike suggestions). Presentational:
 * emits `pick` / `view-auction` and the parent acts on them.
 */
import { PRETTY_ID_TIER_LABEL } from '~/constants/pretty-id'
import type { PrettyIdSearchReason, PrettyIdSearchResult } from '~/types/pretty-id'

// ========================================
// Config
// ========================================

const props = defineProps<{
  /** The searched text (the page's `?q=`). */
  query: string
  /** The result for `query`, or `null` while it is not known. */
  result: PrettyIdSearchResult | null
  /** A lookup for `query` is in flight. */
  isSearching: boolean
  /** Level that unlocks the slot this ID belongs to; `null` until `me` has loaded. */
  rewardLevel: number | null
}>()

const emit = defineEmits<{
  pick: [id: string]
  'view-auction': []
}>()

// ========================================
// Constants
// ========================================

const NUMBER_SIZE_LARGE = 'text-[clamp(38px,14.5vw,54px)]'
const NUMBER_SIZE_MEDIUM = 'text-[clamp(32px,12vw,44px)]'
const MSG_INVALID_FALLBACK = 'That is not a valid Pretty ID.'

/** Keyed by the full reason union, so a new reason is a compile error here. */
const REASON_VARIANT: Record<PrettyIdSearchReason, Variant> = {
  invalid: 'invalid',
  auction_only: 'auction',
  taken: 'unavailable',
  reserved: 'unavailable',
}

// ========================================
// Types
// ========================================

type Variant = 'idle' | 'searching' | 'failed' | 'invalid' | 'auction' | 'available' | 'unavailable'

// ========================================
// State
// ========================================

const variant = computed<Variant>(() => {
  const result = props.result
  if (result === null) {
    if (props.query === '') return 'idle'
    return props.isSearching ? 'searching' : 'failed'
  }
  if (result.reason !== null) return REASON_VARIANT[result.reason]
  return result.available ? 'available' : 'unavailable'
})

const isTaken = computed(() => props.result?.reason === 'taken')

/** "Lucky pattern · Lv 17 reward" — each part drops out when unknown. */
const availableDetail = computed(() => {
  const tier = props.result?.tier
  return [
    tier ? `${PRETTY_ID_TIER_LABEL[tier]} pattern` : null,
    props.rewardLevel === null ? null : `Lv ${props.rewardLevel} reward`,
  ].filter(part => part !== null).join(' · ')
})
</script>

<template>
  <p v-if="variant === 'idle'" class="pid-empty">Type an ID above to search.</p>
  <p v-else-if="variant === 'searching'" class="pid-empty" role="status">Searching…</p>
  <p v-else-if="variant === 'failed'" class="pid-empty">Could not check this ID. Try searching again.</p>

  <template v-else-if="result">
    <p v-if="variant === 'invalid'" class="pid-body p-2 text-center">{{ result.message ?? MSG_INVALID_FALLBACK }}</p>

    <div v-else-if="variant === 'auction'" class="text-center">
      <span class="pid-num pid-gold" :class="NUMBER_SIZE_LARGE">{{ result.id }}</span>
      <p class="pid-body pid-small my-2">1–99 are rare auction-only IDs</p>
      <PrettyIdButton @click="emit('view-auction')">View auction</PrettyIdButton>
    </div>

    <div v-else-if="variant === 'available'" class="text-center">
      <p class="pid-head text-[13px] text-(--pid-ok)">Available</p>
      <span class="pid-num pid-gold" :class="NUMBER_SIZE_LARGE">{{ result.id }}</span>
      <p class="pid-body pid-small">{{ availableDetail }}</p>
      <div class="mt-3">
        <PrettyIdButton @click="emit('pick', result.id)">Claim now</PrettyIdButton>
      </div>
    </div>

    <template v-else>
      <div class="text-center">
        <p class="pid-head text-[13px] text-(--pid-bad)">{{ isTaken ? 'Taken' : 'Not allowed' }}</p>
        <span class="pid-num pid-gold" :class="NUMBER_SIZE_MEDIUM">{{ result.id }}</span>
        <p class="pid-body pid-small my-1.5">
          {{ isTaken ? 'This ID already has an owner. Try these matching patterns:' : 'This number is reserved.' }}
        </p>
      </div>
      <div v-if="result.suggestions.length > 0" class="pid-card-grid">
        <PrettyIdNumberCard
          v-for="suggestion in result.suggestions"
          :id="suggestion.id"
          :key="suggestion.id"
          :tier="suggestion.tier"
          @pick="emit('pick', $event)"
        />
      </div>
      <p v-else class="pid-empty">No close matches free.</p>
    </template>
  </template>
</template>
