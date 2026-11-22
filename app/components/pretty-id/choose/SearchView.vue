<script setup lang="ts">
/**
 * The search-result screen (sub-layout, no hero): a search box to try another
 * ID, and a panel with the outcome for the ID in `?q=`. Running the search is
 * `usePrettyIdSearchPage`'s job; this only renders the store.
 * Mounted by `pages/pretty-id/search.vue`.
 */
import { PRETTY_ID_ROUTES } from '~/constants/pretty-id'
import { usePrettyIdStore } from '~/stores/prettyId'
import { prettyIdSlotKeyForLength } from '~/utils/pretty-id-slots'

// ========================================
// Config
// ========================================

const props = defineProps<{
  /** The searched ID, from the route's `?q=`. */
  query: string
}>()

// ========================================
// State
// ========================================

const store = usePrettyIdStore()

/** The store holds one result at a time — ignore it unless it answers THIS query. */
const isCurrent = computed(() => store.searchQuery === props.query)
const result = computed(() => (isCurrent.value ? store.searchResult : null))
/** True from the route change until the matching lookup settles. */
const isPending = computed(() => store.isSearching || !isCurrent.value)

const panelTitle = computed(() => {
  if (result.value?.available) return 'Available'
  if (result.value?.reason === 'taken') return 'ID Taken'
  return 'Search result'
})

/** Level of the slot the searched ID would fill (6 digits → Lv 17, 4 → Lv 34). */
const rewardLevel = computed(() => {
  const id = result.value?.id
  if (id === undefined) return null
  const slotKey = prettyIdSlotKeyForLength(id.length)
  return slotKey === null ? null : (store.me?.slots[slotKey].required_level ?? null)
})

// ========================================
// Composables
// ========================================

usePrettyIdSearchPage(() => props.query)
const { submitSearch } = usePrettyIdData()
const { pickId } = usePrettyIdClaimActions()

// ========================================
// Handlers
// ========================================

function onSearch(value: string): void {
  void submitSearch(value)
}

function onViewAuction(): void {
  void navigateTo(PRETTY_ID_ROUTES.auction)
}
</script>

<template>
  <!-- `.pid-sec` sets its own padding, which beats a utility: `pt-5` is the 20px the
       sub-layout's top bar needs. -->
  <div class="pid-sec pt-5">
    <PrettyIdSearchBar :initial="query" @submit="onSearch" />

    <PrettyIdPanel :title="panelTitle">
      <PrettyIdSearchResultBody
        :query="query"
        :result="result"
        :is-searching="isPending"
        :reward-level="rewardLevel"
        @pick="pickId"
        @view-auction="onViewAuction"
      />
    </PrettyIdPanel>
  </div>
</template>
