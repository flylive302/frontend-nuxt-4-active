<script setup lang="ts">
/**
 * The Choose ID tab: length chips, tier shields, search box and the grid of
 * claimable IDs. Whole-tab locked below the 6-digit level; the 4-digit list is
 * locked on its own. While a change is under way a banner offers to cancel it.
 * Mounted by `pages/pretty-id/index.vue` inside the tab layout (which owns the gutter).
 */
import {
  PRETTY_ID_LENGTH_SLOT,
  PRETTY_ID_SLOT_KEYS,
  PRETTY_ID_SLOT_LABEL,
  PRETTY_ID_SLOT_LENGTH,
} from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdLength, PrettyIdTier } from '~/types/pretty-id'

// ========================================
// State
// ========================================

const store = usePrettyIdStore()

const sixDigitSlot = computed(() => store.me?.slots.lv17 ?? null)
/** The slot behind the selected length chip. */
const listSlot = computed(() => store.me?.slots[PRETTY_ID_LENGTH_SLOT[store.listLength]] ?? null)
/** Digit count of the ID being replaced, or `null` when this is a first claim. */
const changeLength = computed(() => (store.changeSlot === null ? null : PRETTY_ID_SLOT_LENGTH[store.changeSlot]))

// ========================================
// Composables
// ========================================

const { loadList, selectLength, toggleTier, submitSearch } = usePrettyIdData()
const { pickId, cancelChange } = usePrettyIdClaimActions()

// ========================================
// Handlers
// ========================================

function onSelectLength(length: PrettyIdLength): void {
  void selectLength(length)
}

function onToggleTier(tier: PrettyIdTier): void {
  void toggleTier(tier)
}

function onSearch(value: string): void {
  void submitSearch(value)
}

onMounted(() => {
  void loadList()
})
</script>

<template>
  <div>
    <div v-if="!sixDigitSlot" class="flex justify-center py-10" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-(--pid-gold) motion-reduce:animate-none" />
      <span class="sr-only">Loading…</span>
    </div>

    <PrettyIdLocked
      v-else-if="!sixDigitSlot.unlocked"
      context="six-digit"
      :required-level="sixDigitSlot.required_level"
    />

    <template v-else>
      <PrettyIdRow v-if="changeLength !== null">
        <span class="pid-body pid-small min-w-0 flex-1 leading-snug">
          Changing your {{ changeLength }}-digit ID: pick a new one
        </span>
        <PrettyIdButton size="sm" @click="cancelChange">Cancel</PrettyIdButton>
      </PrettyIdRow>

      <div class="mt-1.5 mb-0.5 flex flex-wrap justify-center gap-1.5">
        <PrettyIdChip
          v-for="key in PRETTY_ID_SLOT_KEYS"
          :key="key"
          :active="store.listLength === PRETTY_ID_SLOT_LENGTH[key]"
          @click="onSelectLength(PRETTY_ID_SLOT_LENGTH[key])"
        >
          {{ PRETTY_ID_SLOT_LABEL[key] }}
        </PrettyIdChip>
      </div>

      <PrettyIdTierShields :active="store.listTier" @toggle="onToggleTier" />

      <PrettyIdSearchBar class="mt-2.5" :initial="store.searchQuery" @submit="onSearch" />

      <PrettyIdLocked
        v-if="listSlot && !listSlot.unlocked"
        context="four-digit"
        :required-level="listSlot.required_level"
      />
      <PrettyIdNumberGrid
        v-else
        :items="store.items"
        :total="store.itemsTotal"
        :is-loading="store.isListLoading"
        @pick="pickId"
      />
    </template>
  </div>
</template>
