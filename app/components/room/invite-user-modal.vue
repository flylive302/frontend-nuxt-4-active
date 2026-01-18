<script setup lang="ts">
// ========================================
// Invite User Modal
// ========================================
//
// Modal with user search for sending room invitations.
// ========================================

import type { User } from '~/types/auth'

// ========================================
// Props
// ========================================

const props = defineProps<{
  roomId: number
}>()

// ========================================
// State
// ========================================

const open = defineModel<boolean>('open', { default: false })
const searchQuery = ref('')
const searchResults = ref<User[]>([])
const loading = ref(false)
const inviting = ref(false)

// ========================================
// Composables
// ========================================

const { sendInvitation } = useRoomInvitations()
const { api, normalizeError } = useApi()
const toast = useToast()

// ========================================
// Debounced Search
// ========================================

const debouncedSearch = useDebounceFn(async (query: string) => {
  if (!query || query.length < 2) {
    searchResults.value = []
    return
  }

  loading.value = true
  try {
    const response = await api<{ data: User[] }>('/users/search', {
      params: { search: query, per_page: 10 },
    })
    searchResults.value = response.data || []
  } catch (err) {
    console.error('[InviteUserModal] Search failed:', err)
    searchResults.value = []
  } finally {
    loading.value = false
  }
}, 300)

watch(searchQuery, (query) => {
  debouncedSearch(query)
})

// ========================================
// Handlers
// ========================================

async function handleInvite(user: User) {
  inviting.value = true
  try {
    const result = await sendInvitation(props.roomId, { user_id: user.id })
    if (result) {
      searchResults.value = searchResults.value.filter(u => u.id !== user.id)
      searchQuery.value = ''
    }
  } finally {
    inviting.value = false
  }
}

// Reset on close
watch(open, (isOpen) => {
  if (!isOpen) {
    searchQuery.value = ''
    searchResults.value = []
  }
})
</script>

<template>
  <UDrawer v-model:open="open" title="Invite User" description="Search and invite users to join your room.">
    <template #content>
      <div class="px-3 mt-3 pb-4">

        <!-- Search Input -->
        <UInput
          v-model="searchQuery"
          icon="i-lucide-search"
          placeholder="Search by name or signature..."
          size="lg"
          class="mb-4"
          :loading="loading"
        />

        <!-- Search Results -->
        <div class="space-y-2 max-h-80 overflow-y-auto">
          <div v-if="loading" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
          </div>
          <div v-else-if="searchQuery.length >= 2 && searchResults.length === 0" class="text-center py-8 text-muted">
            No users found
          </div>
          <div v-else-if="searchQuery.length < 2 && searchQuery.length > 0" class="text-center py-4 text-muted text-sm">
            Type at least 2 characters to search
          </div>
          <div 
            v-else
            v-for="user in searchResults" 
            :key="user.id"
            class="flex items-center gap-3 p-3 rounded-lg bg-elevated/30 hover:bg-elevated/50 transition"
          >
            <LazyUserAvatar :img="user.avatar" class="size-12" />
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ user.name }}</p>
              <ProfileBadge v-if="user.signature" :txt="user.signature" :show-badge="false" />
            </div>
            <UButton
              icon="i-lucide-send"
              color="primary"
              variant="soft"
              size="sm"
              :loading="inviting"
              @click="handleInvite(user)"
            >
              Invite
            </UButton>
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
