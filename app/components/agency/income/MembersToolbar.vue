<!-- ~/components/agency/income/MembersToolbar.vue -->
<!-- Search + sort bar for the owner/admin members list. Search emits on every
     keystroke (the caller debounces); sort direction toggles asc/desc. Local
     text is seeded from the `search` prop on mount only — the parent re-keys
     this component per cycle, so watching the prop would clobber typing. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { ref } from 'vue'
import type { OwnerIncomeMemberSort, OwnerIncomeSortDirection } from '~/types/income/ownerIncome'

// ========================================
// Constants
// ========================================

const SORT_OPTIONS: { label: string, value: OwnerIncomeMemberSort }[] = [
  { label: 'Income', value: 'income' },
  { label: 'Earned', value: 'earned' },
  { label: 'Exchanged', value: 'exchanged' },
  { label: 'Deducted', value: 'deducted' },
  { label: 'Gift coins', value: 'xp' },
  { label: 'Name', value: 'name' },
]

// ========================================
// Props / Emits
// ========================================

const props = withDefaults(defineProps<{
  search: string
  sort: OwnerIncomeMemberSort
  direction: OwnerIncomeSortDirection
  disabled?: boolean
}>(), {
  disabled: false,
})

const emit = defineEmits<{
  search: [value: string]
  sort: [value: OwnerIncomeMemberSort]
  direction: [value: OwnerIncomeSortDirection]
}>()

// ========================================
// State
// ========================================

const searchText = ref(props.search)

// ========================================
// Handlers
// ========================================

function handleSearchInput(value: string | number): void {
  const text = String(value)
  searchText.value = text
  emit('search', text)
}

function clearSearch(): void {
  searchText.value = ''
  emit('search', '')
}

function handleSortChange(value: string | number | undefined): void {
  if (value) emit('sort', value as OwnerIncomeMemberSort)
}

function toggleDirection(): void {
  emit('direction', props.direction === 'asc' ? 'desc' : 'asc')
}
</script>

<template>
  <div class="flex items-center gap-2">
    <UInput
      :model-value="searchText"
      placeholder="Search name or ID"
      icon="i-lucide-search"
      class="grow"
      :disabled="disabled"
      @update:model-value="handleSearchInput"
    >
      <template v-if="searchText" #trailing>
        <UButton
          icon="i-lucide-x"
          color="neutral"
          variant="link"
          size="xs"
          aria-label="Clear search"
          @click="clearSearch"
        />
      </template>
    </UInput>

    <USelect
      :model-value="sort"
      :items="SORT_OPTIONS"
      class="w-32 shrink-0"
      :disabled="disabled"
      @update:model-value="handleSortChange"
    />

    <UButton
      :icon="direction === 'asc' ? 'i-lucide-arrow-up-wide-narrow' : 'i-lucide-arrow-down-wide-narrow'"
      color="neutral"
      variant="soft"
      class="shrink-0"
      :disabled="disabled"
      :aria-label="direction === 'asc' ? 'Sort ascending' : 'Sort descending'"
      @click="toggleDirection"
    />
  </div>
</template>
