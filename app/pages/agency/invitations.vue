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

// ========================================
// Component State
// ========================================

const processingId = ref<number | null>(null)

// ========================================
// Event Handlers
// ========================================

async function handleAccept(invitationId: number): Promise<void> {
  processingId.value = invitationId
  await agencyStore.acceptInvitation(invitationId)
  processingId.value = null
}

async function handleDecline(invitationId: number): Promise<void> {
  processingId.value = invitationId
  await agencyStore.declineInvitation(invitationId)
  processingId.value = null
}

async function handleBlockAgency(agencyId: number): Promise<void> {
  await agencyStore.blockAgency(agencyId)
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  agencyStore.fetchReceivedInvitations(true)
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
          class="p-4 bg-elevated rounded-lg border"
          :class="invitation.can_respond ? 'border-primary/30' : 'border-muted/30 opacity-60'"
        >
          <!-- Agency Info -->
          <NuxtLink
            :to="`/agency/${invitation.agency?.id}`"
            class="flex gap-3 mb-3"
          >
            <NuxtImg
              :src="invitation.agency?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${invitation.agency?.name}`"
              :alt="invitation.agency?.name"
              class="size-12 rounded-lg object-cover border border-muted"
            />
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold truncate">{{ invitation.agency?.name }}</h3>
              <div class="flex items-center gap-2 text-sm text-muted">
                <icon :name="`i-flag-${invitation.agency?.country.toLowerCase()}-4x3`" class="size-4 rounded" />
                <span>{{ invitation.agency?.country }}</span>
              </div>
            </div>
          </NuxtLink>

          <!-- Invited By -->
          <p class="text-sm text-muted mb-2">
            Invited by <span class="font-medium">{{ invitation.invited_by.name }}</span>
          </p>

          <!-- Expiry -->
          <div
            class="flex items-center gap-1 text-sm mb-3"
            :class="invitation.is_expired ? 'text-error' : 'text-warning'"
          >
            <icon name="i-lucide-clock" class="size-4" />
            <span>{{ invitation.is_expired ? 'Expired' : formatExpiryTime(invitation.expires_at) }}</span>
          </div>

          <!-- Actions -->
          <div v-if="invitation.can_respond" class="flex gap-2">
            <UButton
              color="success"
              class="flex-1 justify-center"
              :loading="processingId === invitation.id"
              @click="handleAccept(invitation.id)"
            >
              Accept
            </UButton>
            <UButton
              variant="outline"
              color="error"
              class="flex-1 justify-center"
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

          <!-- Block Agency Option -->
          <UButton
            v-if="invitation.can_respond"
            variant="ghost"
            color="neutral"
            size="xs"
            class="w-full mt-2"
            icon="i-lucide-ban"
            @click="handleBlockAgency(invitation.agency?.id || 0)"
          >
            Block this agency
          </UButton>
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
