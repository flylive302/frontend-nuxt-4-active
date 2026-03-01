<script setup lang="ts">
// ========================================
// User Search Drawer
// ========================================
//
// Reusable drawer component for searching users by name, ID, or signature.
// Renders results using MinimalUserList and exposes scoped slots for custom actions.
// ========================================

import type { MinimalUser } from '~/types/user/bootstrap'

// ========================================
// Props
// ========================================

withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: 'Search Users',
  description: 'Search by name, ID, or signature.',
})

// ========================================
// State
// ========================================

const open = defineModel<boolean>('open', { default: false })
const searchQuery = ref('')

// ========================================
// Composables
// ========================================

const { users, loading, error, hasMore, searchUsers, loadMore } = useUserSearch()

// ========================================
// Debounced Search
// ========================================

const debouncedSearch = useDebounceFn((query: string) => {
  if (!query || query.length < 2) {
    return
  }
  void searchUsers(query)
}, 300)

watch(searchQuery, (query) => {
  if (!query || query.length < 2) {
    void searchUsers('', true)
    return
  }
  debouncedSearch(query)
})

// ========================================
// Handlers
// ========================================

/**
 * Load the next page of search results.
 */
function handleLoadMore(): void {
  if (!searchQuery.value || searchQuery.value.length < 2) return
  void loadMore(searchQuery.value)
}

// ========================================
// Lifecycle
// ========================================

/**
 * Reset search state when drawer closes.
 */
watch(open, (isOpen) => {
  if (!isOpen) {
    searchQuery.value = ''
    void searchUsers('', true)
  }
})
</script>

<template>
  <UDrawer v-model:open="open" :title="title" :description="description">
    <template #content>
      <div class="px-3 mt-3 pb-4">

        <!-- Search Input -->
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search by name or signature..."
          size="lg"
          class="mb-4 w-full"
          :loading="loading"
        />

        <!-- Search Results -->
        <div class="space-y-2 max-h-80 overflow-y-auto">

          <!-- Loading State -->
          <div v-if="loading && users.length === 0" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
          </div>

          <!-- Empty State -->
          <div v-else-if="searchQuery.length >= 2 && users.length === 0 && !loading" class="text-center py-8 text-muted">
            <slot name="empty">No users found</slot>
          </div>

          <!-- Hint State -->
          <div v-else-if="searchQuery.length > 0 && searchQuery.length < 2" class="text-center py-4 text-muted text-sm">
            Type at least 2 characters to search
          </div>

          <!-- Results List -->
          <template v-else>
            <MinimalUserList
              v-for="user in users"
              :key="user.id"
              :user="user"
            >
              <template v-if="$slots.actions" #actions>
                <slot name="actions" :user="user" />
              </template>
            </MinimalUserList>

            <!-- Load More -->
            <div v-if="hasMore && users.length > 0" class="flex justify-center pt-2">
              <UButton
                variant="ghost"
                color="neutral"
                size="sm"
                :loading="loading"
                icon="i-lucide-chevrons-down"
                @click="handleLoadMore"
              >
                Load more
              </UButton>
            </div>
          </template>

          <!-- Error State -->
          <div v-if="error" class="text-center py-4 text-error text-sm">
            {{ error }}
          </div>
        </div>

        <!-- Close Button -->
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-x"
          class="justify-center mt-4 w-full"
          @click="open = false"
        >
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
