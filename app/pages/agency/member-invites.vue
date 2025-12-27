<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, ref } from 'vue'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ 
  layout: 'alt',
  middleware: 'auth',
})

// ========================================
// Composables / Injected Dependencies
// ========================================

const agencyStore = useAgencyStore()

// ========================================
// Component State
// ========================================

const cancellingId = ref<number | null>(null)
const showInviteModal = ref(false)
const searchQuery = ref('')
const searchResults = ref<Array<{ id: number; name: string; signature?: string; avatar?: string }>>([])
const searching = ref(false)
const sending = ref(false)

// ========================================
// Computed
// ========================================

const invitations = computed(() => agencyStore.sentInvitations.items)
const loading = computed(() => agencyStore.sentInvitations.loading)

const pendingInvitations = computed(() =>
  invitations.value.filter(i => i.status === 'pending' && !i.is_expired)
)

const historyInvitations = computed(() =>
  invitations.value.filter(i => i.status !== 'pending' || i.is_expired)
)

// ========================================
// Event Handlers
// ========================================

async function handleCancel(invitationId: number): Promise<void> {
  cancellingId.value = invitationId
  await agencyStore.cancelInvitation(invitationId)
  cancellingId.value = null
}

async function handleSendInvite(userId: number): Promise<void> {
  sending.value = true
  const result = await agencyStore.sendInvitation({ user_id: userId })
  sending.value = false
  
  if (result) {
    showInviteModal.value = false
    searchQuery.value = ''
    searchResults.value = []
  }
}

// Note: User search would require a backend endpoint
// For now, this is a placeholder for the UI
async function handleSearch(): Promise<void> {
  if (searchQuery.value.length < 2) {
    searchResults.value = []
    return
  }
  
  searching.value = true
  // TODO: Implement user search API call
  // const { api } = useApi()
  // const response = await api('/users/search', { params: { query: searchQuery.value } })
  // searchResults.value = response.data
  
  // Placeholder: Show empty for now
  searchResults.value = []
  searching.value = false
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  agencyStore.fetchSentInvitations(true)
})

// ========================================
// Helpers
// ========================================

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatExpiryTime(expiresAt: string): string {
  const now = new Date()
  const expiry = new Date(expiresAt)
  const diffMs = expiry.getTime() - now.getTime()
  
  if (diffMs <= 0) return 'Expired'
  
  const diffDays = Math.floor(diffMs / 86400000)
  const diffHours = Math.floor((diffMs % 86400000) / 3600000)
  
  if (diffDays > 0) return `${diffDays}d left`
  if (diffHours > 0) return `${diffHours}h left`
  return 'Expiring soon'
}

function getStatusColor(status: string, isExpired: boolean): 'error' | 'info' | 'primary' | 'secondary' | 'success' | 'warning' | 'tertiary' | 'neutral' {
  if (isExpired) return 'neutral'
  switch (status) {
    case 'pending': return 'warning'
    case 'accepted': return 'success'
    case 'declined': return 'error'
    case 'cancelled': return 'neutral'
    default: return 'neutral'
  }
}
</script>

<template>
  <main>
    <NavAlt back-to="/agency/my-agency">
      Sent Invitations
      <template #action>
        <UButton
          v-if="agencyStore.isAgencyAdmin"
          variant="soft"
          size="sm"
          icon="i-lucide-user-plus"
          @click="showInviteModal = true"
        >
          Invite
        </UButton>
      </template>
    </NavAlt>

    <div class="px-3 pt-14 pb-24">
      <!-- Loading State -->
      <div v-if="loading && invitations.length === 0" class="space-y-3">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="p-4 bg-elevated rounded-lg space-y-3">
            <div class="flex gap-3">
              <div class="size-10 bg-muted rounded-full" />
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-muted rounded w-3/4" />
                <div class="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!loading && invitations.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-mail" class="size-10 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-1">No Invitations Sent</h3>
        <p class="text-sm text-muted max-w-xs">
          Invite users to join your agency.
        </p>
        <UButton
          v-if="agencyStore.isAgencyAdmin"
          variant="soft"
          color="primary"
          class="mt-4"
          icon="i-lucide-user-plus"
          @click="showInviteModal = true"
        >
          Send Invitation
        </UButton>
      </div>

      <!-- Invitations List -->
      <div v-else class="space-y-6">
        <!-- Pending -->
        <div v-if="pendingInvitations.length > 0">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Pending ({{ pendingInvitations.length }})
          </h3>
          <div class="space-y-3">
            <div
              v-for="invitation in pendingInvitations"
              :key="invitation.id"
              class="p-3 bg-elevated rounded-lg border border-warning/30"
            >
              <div class="flex items-center gap-3">
                <UserAvatar
                  :img="invitation.user?.avatar || undefined"
                  class="w-10 shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-semibold truncate">{{ invitation.user?.name }}</p>
                  <div class="flex items-center gap-2 text-xs text-muted">
                    <span>{{ formatExpiryTime(invitation.expires_at) }}</span>
                    <span>•</span>
                    <span>by {{ invitation.invited_by.name }}</span>
                  </div>
                </div>
                <UButton
                  variant="ghost"
                  color="error"
                  size="sm"
                  icon="i-lucide-x"
                  :loading="cancellingId === invitation.id"
                  @click="handleCancel(invitation.id)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- History -->
        <div v-if="historyInvitations.length > 0">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            History
          </h3>
          <div class="space-y-2">
            <div
              v-for="invitation in historyInvitations"
              :key="invitation.id"
              class="p-3 bg-elevated rounded-lg opacity-60"
            >
              <div class="flex items-center gap-3">
                <UserAvatar
                  :img="invitation.user?.avatar || undefined"
                  class="w-8 shrink-0"
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate text-sm">{{ invitation.user?.name }}</p>
                </div>
                <UBadge 
                  :color="getStatusColor(invitation.status, invitation.is_expired)" 
                  size="xs"
                >
                  {{ invitation.is_expired ? 'Expired' : invitation.status_label }}
                </UBadge>
                <span class="text-xs text-muted">{{ formatDate(invitation.created_at) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <UAlert
        v-if="agencyStore.sentInvitations.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="agencyStore.sentInvitations.error"
        class="mt-4"
      />
    </div>

    <!-- Invite User Modal -->
    <UModal v-model:open="showInviteModal">
      <template #content>
        <div class="p-4 space-y-4">
          <h3 class="text-lg font-semibold">Invite User</h3>
          <p class="text-sm text-muted">
            Search for a user to invite to your agency.
          </p>
          
          <UInput
            v-model="searchQuery"
            placeholder="Search by name or @signature..."
            icon="i-lucide-search"
            :loading="searching"
            @input="handleSearch"
          />
          
          <!-- Search Results -->
          <div v-if="searchResults.length > 0" class="space-y-2 max-h-60 overflow-y-auto">
            <div
              v-for="user in searchResults"
              :key="user.id"
              class="flex items-center gap-3 p-2 bg-elevated rounded cursor-pointer hover:bg-muted/20"
              @click="handleSendInvite(user.id)"
            >
              <UserAvatar :img="user.avatar" class="w-8" />
              <div class="flex-1">
                <p class="font-medium text-sm">{{ user.name }}</p>
                <p v-if="user.signature" class="text-xs text-muted">@{{ user.signature }}</p>
              </div>
              <UButton
                variant="soft"
                size="xs"
                :loading="sending"
              >
                Invite
              </UButton>
            </div>
          </div>
          
          <!-- No Results -->
          <div v-else-if="searchQuery.length >= 2 && !searching" class="text-center py-4 text-muted">
            <p class="text-sm">No users found</p>
          </div>
          
          <!-- Search Hint -->
          <div v-else-if="searchQuery.length < 2" class="text-center py-4 text-muted">
            <p class="text-sm">Enter at least 2 characters to search</p>
          </div>
          
          <div class="flex justify-end">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showInviteModal = false"
            >
              Close
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>