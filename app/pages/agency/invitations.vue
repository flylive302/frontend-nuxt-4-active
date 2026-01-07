<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted } from 'vue'

// ========================================
// Imports from Utils
// ========================================

import { formatExpiryTime } from '~/utils/agency-format'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ========================================
// Composables / Injected Dependencies
// ========================================

const agencyStore = useAgencyStore()
const { acceptInvitation, declineInvitation, fetchReceivedInvitations } = useAgencyInvitations()
const { blockAgency } = useAgencyAdmin()

// ========================================
// Component State
// ========================================

const processingId = ref<number | null>(null)

// ========================================
// Event Handlers
// ========================================

async function handleAccept(invitationId: number): Promise<void> {
  processingId.value = invitationId
  await acceptInvitation(invitationId)
  processingId.value = null
}

async function handleDecline(invitationId: number): Promise<void> {
  processingId.value = invitationId
  await declineInvitation(invitationId)
  processingId.value = null
}

async function handleBlockAgency(agencyId: number): Promise<void> {
  await blockAgency(agencyId)
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  fetchReceivedInvitations(true)
})
</script>

<template>
  <main>
    <NavAlt back-to="/profile">Agency Invitations</NavAlt>

    <div class="px-3 pt-14 pb-24">
      <!-- Loading State -->
      <div v-if="agencyStore.receivedInvitations.loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="p-4 bg-elevated rounded-lg space-y-3">
            <div class="flex gap-3">
              <div class="size-12 bg-muted rounded-lg" />
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-muted rounded w-3/4" />
                <div class="h-3 bg-muted rounded w-1/2" />
              </div>
            </div>
            <div class="h-10 bg-muted rounded" />
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="agencyStore.receivedInvitations.items.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-mail-x" class="size-10 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-1">No Invitations</h3>
        <p class="text-sm text-muted max-w-xs">
          When agencies invite you to join, their invitations will appear here.
        </p>
        <UButton
          variant="soft"
          color="primary"
          class="mt-4"
          to="/agency/list"
          icon="i-lucide-search"
        >
          Browse Agencies
        </UButton>
      </div>

      <!-- Invitations List -->
      <div v-else class="space-y-3">
        <div
          v-for="invitation in agencyStore.receivedInvitations.items"
          :key="invitation.id"
          class="bg-linear-to-bl to-neutral-950 rounded-lg border relative overflow-hidden"
          :class="invitation.can_respond ? 'border-primary/30' : 'border-muted/30 opacity-70'"
        >
          <!-- Agency Info -->
          <NuxtLink
            :to="`/agency/${invitation.agency?.id}`"
            class="flex gap-2 p-2 border-b border-black shadow-lg shadow-primary-950/50"
          >
            <NuxtImg
              :src="invitation.agency?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${invitation.agency?.name}`"
              :alt="invitation.agency?.name"
              class="size-12"
            />

            <div class="flex gap-1 min-w-0">
              <div class="">
                <h3 class="font-semibold truncate">{{ invitation.agency?.name }}</h3>
                <div class="flex items-center gap-2 text-sm">
                  <icon :name="`i-flag-${invitation.agency?.country.toLowerCase()}-4x3`" class="size-6 h-5 rounded shadow-md" />
                  <span>{{ invitation.agency?.country }}</span>
                  <!-- Expiry -->
                  <UBadge
                      class="flex items-center gap-1 text-xs"
                      :color="invitation.is_expired ? 'error' : 'warning'"
                      variant="soft"
                      size="sm"
                      icon="i-lucide-clock"
                  >
                    {{ invitation.is_expired ? 'Expired' : formatExpiryTime(invitation.expires_at) }}
                  </UBadge>
                </div>
              </div>

              <div class="flex flex-col items-end gap-2">
                <p class="text-muted text-xs">Invited by <span class="font-medium text-primary">{{ invitation.invited_by.name }}</span></p>
                <!-- Block Agency Option -->
                <UButton
                    v-if="invitation.can_respond"
                    variant="soft"
                    color="warning"
                    size="xs"
                    icon="i-lucide-ban"
                    @click="handleBlockAgency(invitation.agency?.id || 0)"
                >
                  Block Agency
                </UButton>
              </div>
            </div>
          </NuxtLink>

          <div class="inset-shadow-sm">
            <!-- Actions -->
            <div v-if="invitation.can_respond" class="flex">
              <UButton
                  color="success"
                  variant="soft"
                  icon="i-lucide-ticket-check"
                  class="flex-1 justify-center rounded-none"
                  :loading="processingId === invitation.id"
                  @click="handleAccept(invitation.id)"
              >
                Accept
              </UButton>
              <UButton
                  variant="soft"
                  color="error"
                  class="flex-1 justify-center rounded-none"
                  icon="i-lucide-x"
                  :loading="processingId === invitation.id"
                  @click="handleDecline(invitation.id)"
              >
                Decline
              </UButton>
            </div>

            <!-- Expired/Processed State -->
            <div v-else class="flex items-center justify-center py-2 text-muted">
              <span class="text-sm">{{ invitation.status_label }}</span>
            </div>

          </div>
        </div>

      </div>

      <!-- Error State -->
      <UAlert
        v-if="agencyStore.receivedInvitations.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="agencyStore.receivedInvitations.error"
        class="mt-4"
      />
    </div>
  </main>
</template>
