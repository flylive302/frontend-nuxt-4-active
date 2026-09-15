<!-- ~/components/agency/income/MembersList.vue -->
<!-- Roster list section: skeleton while page 1 loads, error/empty/no-results
     states, then cards with a "Load more" trailer. Stateless — all data and
     paging state comes from the caller. -->
<script setup lang="ts">
// ========================================
// Imports
// ========================================

import { computed } from 'vue'
import type { OwnerIncomeMemberRow } from '~/types/income/ownerIncome'

// ========================================
// Props / Emits
// ========================================

const props = defineProps<{
  rows: OwnerIncomeMemberRow[]
  hasMore: boolean
  loadingPage: number | null
  search: string
  error: string | null
}>()

const emit = defineEmits<{
  'load-more': []
  retry: []
  'open-member': [member: OwnerIncomeMemberRow]
}>()

// ========================================
// Computed
// ========================================

const isLoadingMore = computed(() => props.loadingPage !== null && props.loadingPage > 1)
</script>

<template>
  <!-- Page 1 loading -->
  <AgencyIncomeMemberIncomeCardSkeleton v-if="loadingPage === 1" />

  <!-- Failed with nothing loaded -->
  <div v-else-if="error && rows.length === 0" class="text-center py-6 bg-elevated rounded-lg">
    <p class="text-sm text-muted mb-2">Could not load members.</p>
    <UButton size="sm" variant="soft" icon="i-lucide-rotate-cw" @click="emit('retry')">Retry</UButton>
  </div>

  <!-- No results for the applied search -->
  <div v-else-if="rows.length === 0 && search !== ''" class="text-center py-8 bg-elevated rounded-lg">
    <UIcon name="i-lucide-search-x" class="size-12 text-muted mb-2" />
    <p class="text-sm text-muted">No members match &ldquo;{{ search }}&rdquo;</p>
  </div>

  <!-- Empty roster -->
  <div v-else-if="rows.length === 0" class="text-center py-8 bg-elevated rounded-lg">
    <UIcon name="i-lucide-users" class="size-12 text-muted mb-2" />
    <p class="text-sm text-muted">No members in this run</p>
  </div>

  <!-- Rows -->
  <div v-else class="space-y-2">
    <AgencyIncomeMemberIncomeCard
      v-for="row in rows"
      :key="row.user_id"
      :member="row"
      @open="emit('open-member', $event)"
    />

    <p v-if="error" class="text-xs text-error text-center">{{ error }}</p>

    <UButton
      v-if="hasMore"
      block
      variant="soft"
      icon="i-lucide-chevron-down"
      :loading="isLoadingMore"
      :disabled="isLoadingMore"
      @click="emit('load-more')"
    >
      Load more
    </UButton>
  </div>
</template>
