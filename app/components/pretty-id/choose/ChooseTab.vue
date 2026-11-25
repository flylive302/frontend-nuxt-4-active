<script setup lang="ts">
/**
 * The Choose ID tab: a tier switch (6-digit / 4-digit), then for the active
 * tier ONE of — the locked panel (level progress), the already-claimed panel
 * (the user's number), or the browse view (category shields, inline exact
 * search, available count, cursor-paged grid).
 * Mounted by `pages/pretty-id/index.vue` inside the tab layout (which owns the gutter).
 */
import { usePrettyIdStore } from '~/stores/prettyId'
import type { PrettyIdCategory, PrettyIdItem, PrettyIdTier } from '~/types/pretty-id'

// ========================================
// State
// ========================================

const store = usePrettyIdStore()

// ========================================
// Composables
// ========================================

const { loadList, loadMore, selectTier, toggleCategory, runSearch } = usePrettyIdData()
const { pickItem } = usePrettyIdClaimActions()

// The list loads whenever a browsable tier becomes the active one: on entry once `me`
// has arrived, on a tier switch, and when a refreshed `me` unlocks the tier.
watch(
  () => store.browseTier,
  (tier) => {
    if (tier !== null) void loadList()
  },
  { immediate: true },
)

// ========================================
// Handlers
// ========================================

function onSelectTier(tier: PrettyIdTier): void {
  selectTier(tier)
}

function onToggleCategory(category: PrettyIdCategory): void {
  void toggleCategory(category)
}

function onSearch(value: string): void {
  void runSearch(value)
}

function onPick(item: PrettyIdItem): void {
  pickItem(item)
}

function onLoadMore(): void {
  void loadMore()
}

function onRetry(): void {
  void loadList()
}
</script>

<template>
  <div>
    <div v-if="store.me === null" class="flex justify-center py-10" role="status">
      <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-(--pid-gold) motion-reduce:animate-none" />
      <span class="sr-only">Loading…</span>
    </div>

    <template v-else>
      <PrettyIdTierSwitch :tiers="store.me.tiers" :active="store.activeTier" @select="onSelectTier" />

      <template v-if="store.activeTierState">
        <PrettyIdClaimed v-if="store.tierMode === 'claimed' && store.activeTierState.claimed" :claimed="store.activeTierState.claimed" />

        <PrettyIdLocked
          v-else-if="store.tierMode === 'locked'"
          :tier="store.activeTier"
          :required-level="store.activeTierState.required_level"
        />

        <template v-else-if="store.tierMode === 'browse'">
          <PrettyIdCategoryShields :active="store.category" @toggle="onToggleCategory" />

          <PrettyIdSearchBar
            :key="store.activeTier"
            class="mt-2.5"
            :digits="store.activeTier"
            :initial="store.searchQuery"
            @submit="onSearch"
          />
          <PrettyIdSearchOutcome
            :query="store.searchQuery"
            :status="store.searchStatus"
            :result="store.searchResult"
            @pick="onPick"
          />

          <PrettyIdNumberGrid
            :items="store.items"
            :total="store.itemsTotal"
            :is-loading="store.isListLoading"
            :is-loading-more="store.isListLoadingMore"
            :is-failed="store.isListFailed"
            :has-more="store.hasMore"
            @pick="onPick"
            @load-more="onLoadMore"
            @retry="onRetry"
          />
        </template>
      </template>
    </template>
  </div>
</template>
