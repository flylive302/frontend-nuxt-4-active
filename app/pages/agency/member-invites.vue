<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, ref, computed } from 'vue'
import UserInviteDialog from '~/components/agency/UserInviteDialog.vue'
import type { MinimalUser } from '~/types/bootstrap'

// ========================================
// Imports from Utils
// ========================================

import { formatAgencyDate, formatExpiryTime, getInvitationStatusColor } from '~/utils/agency-format'

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
const { sendInvitation, cancelInvitation, fetchSentInvitations } = useAgencyInvitations()

// ========================================
// Component State
// ========================================

const cancellingId = ref<number | null>(null)
const showInviteDialog = ref(false)

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
  await cancelInvitation(invitationId)
  cancellingId.value = null
}

async function handleInviteUser(user: MinimalUser): Promise<void> {
  // We utilize the composable action which handles the API call and toast
  await sendInvitation({ user_id: user.id })
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  fetchSentInvitations(true)
})
</script>

<template>
  <main>
    <NavAlt back-to="/agency/my-agency">Sent Invitations</NavAlt>

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
          color="primary"
          class="mt-4"
          icon="i-lucide-user-plus"
          @click="showInviteDialog = true"
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
              class="p-2 bg-linear-to-bl to-neutral-950 border border-warning/50 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <UserAvatar
                  :img="invitation.user?.avatar || undefined"
                  class="w-10 shrink-0"
                  animated
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
                  variant="soft"
                  color="error"
                  size="sm"
                  icon="i-lucide-x"
                  :loading="cancellingId === invitation.id"
                  @click="handleCancel(invitation.id)"
                >
                  Cancel
                </UButton>
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
              class="p-2 bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <UserAvatar
                  :img="invitation.user?.avatar || undefined"
                  class="w-8 shrink-0"
                  animated
                />
                <div class="flex-1 min-w-0">
                  <p class="font-medium truncate text-sm">{{ invitation.user?.name }}</p>
                </div>
                <UBadge 
                  :color="getInvitationStatusColor(invitation.status, invitation.is_expired)"
                  variant="subtle"
                  size="md"
                >
                  {{ invitation.is_expired ? 'Expired' : invitation.status_label }}
                </UBadge>
                <span class="text-xs text-muted">{{ formatAgencyDate(invitation.created_at) }}</span>
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

    <footer
        v-if="!loading && invitations.length > 0"
        aria-label="Primary"
        class="fixed inset-x-2 z-50 bottom-8"
    >
      <BgGlass
          class="border border-white/40 p-3"
          frost-blur-radius="blur(8px)"
          :noise-frequency="0.009"
          :noise-strength="200"
          rounded="rounded-lg"
      >
        <!-- Invite Button - Always visible for admins when there are invitations -->
        <UButton
            v-if="agencyStore.isAgencyAdmin && (invitations.length > 0 || !loading)"
            color="primary"
            class="w-full justify-center"
            icon="i-lucide-user-plus"
            @click="showInviteDialog = true"
        >
          Invite A User to Agency
        </UButton>
      </BgGlass>
    </footer>

    <!-- New Invite User Dialog -->
    <UserInviteDialog
      v-model:open="showInviteDialog"
      @select="handleInviteUser"
    />
  </main>
</template>