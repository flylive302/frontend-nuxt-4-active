<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted } from 'vue'
import type { AgencyJoinRequest } from '~/types/agency/agency'

// ========================================
// Imports from Utils
// ========================================

import { formatAgencyDate } from '~/utils/agency-format'

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
const { approveJoinRequest, rejectJoinRequest, fetchJoinRequests } = useAgencyJoinRequests()
const { blockUser } = useAgencyAdmin()

// ========================================
// Component State
// ========================================

const processingId = ref<number | null>(null)
const showBlockModal = ref(false)
const selectedRequest = ref<AgencyJoinRequest | null>(null)

// ========================================
// Computed
// ========================================

const requests = computed(() => agencyStore.joinRequests.items)
const loading = computed(() => agencyStore.joinRequests.loading)
const hasMore = computed(() => agencyStore.joinRequests.hasMore)

// ========================================
// Event Handlers
// ========================================

async function handleApprove(request: AgencyJoinRequest): Promise<void> {
  processingId.value = request.id
  await approveJoinRequest(request.id)
  processingId.value = null
}

async function handleReject(request: AgencyJoinRequest): Promise<void> {
  processingId.value = request.id
  await rejectJoinRequest(request.id)
  processingId.value = null
}

function handleLoadMore(): void {
  fetchJoinRequests()
}

function handleShowBlockModal(request: AgencyJoinRequest): void {
  selectedRequest.value = request
  showBlockModal.value = true
}

async function handleBlockUser(): Promise<void> {
  if (!selectedRequest.value?.user?.id) return
  
  await blockUser(selectedRequest.value.user.id)
  await rejectJoinRequest(selectedRequest.value.id)
  showBlockModal.value = false
  selectedRequest.value = null
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  fetchJoinRequests(true)
})
</script>

<template>
  <main>
    <NavAlt spacer back-to="/agency/my-agency">Join Requests</NavAlt>

    <div class="px-3 pt-14 pb-24">
      <!-- Loading State -->
      <div v-if="loading && requests.length === 0" class="space-y-3">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="p-4 bg-elevated rounded-lg space-y-3">
            <div class="flex gap-3">
              <div class="size-12 bg-muted rounded-full" />
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
        v-else-if="!loading && requests.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-inbox" class="size-10 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-1">No Requests</h3>
        <p class="text-sm text-muted max-w-xs">
          When users request to join your agency, their requests will appear here.
        </p>
      </div>

      <!-- Requests List -->
      <div v-else class="space-y-3">
        <div
          v-for="request in requests"
          :key="request.id"
          class="bg-linear-to-bl to-neutral-950 rounded-lg border border-primary/30 relative overflow-hidden"
        >
          <!-- User Info -->
          <NuxtLink
            :to="`/profile/${request.user?.signature}`"
            class="flex gap-2 p-2 border-b border-black shadow-lg shadow-primary-950/50"
          >
            <UserAvatar
              :img="request.user?.avatar ?? undefined"
              :animated="true"
              class="size-12"
            />

            <div class="flex-1">
              <p class="font-semibold truncate">{{ request.user?.name }}</p>
              <div class="flex items-center gap-1">
                <ProfileBadge :txt="request.user?.signature?.toString()" />
                <!-- Request Date -->
                <p class="text-xs text-muted">
                  Requested {{ formatAgencyDate(request.created_at, { includeTime: true }) }}
                </p>
              </div>
            </div>

            <div class="flex gap-1 absolute top-0 right-0">
              <UButton
                  variant="soft"
                  color="neutral"
                  size="sm"
                  icon="i-lucide-eye"
                  class="rounded-none"
                  :to="`/profile/${request.user?.signature}`"
              />

              <!-- Block Option -->
              <UButton
                  v-if="request.can_be_processed"
                  variant="soft"
                  color="warning"
                  size="xs"
                  icon="i-lucide-ban"
                  class="rounded-none"
                  @click="handleShowBlockModal(request)"
              >
                Block
              </UButton>
            </div>

          </NuxtLink>

          <!-- Request Message -->
          <div v-if="request.message" class="p-2 bg-muted/20 rounded mb-3">
            <p class="text-sm italic">"{{ request.message }}"</p>
          </div>

          <!-- Actions -->
          <div v-if="request.can_be_processed" class="flex">
            <UButton
              color="success"
              variant="soft"
              class="flex-1 justify-center rounded-none"
              :loading="processingId === request.id"
              @click="handleApprove(request)"
            >
              Approve
            </UButton>
            <UButton
              variant="soft"
              color="error"
              class="flex-1 justify-center"
              :loading="processingId === request.id"
              @click="handleReject(request)"
            >
              Reject
            </UButton>
          </div>

        </div>

        <!-- Load More -->
        <div v-if="hasMore" class="flex justify-center pt-4">
          <UButton
            variant="soft"
            color="primary"
            :loading="loading"
            @click="handleLoadMore"
          >
            Load More
          </UButton>
        </div>
      </div>

      <!-- Error State -->
      <UAlert
        v-if="agencyStore.joinRequests.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="agencyStore.joinRequests.error"
        class="mt-4"
      />
    </div>

    <!-- Block User Modal -->
    <UModal v-model:open="showBlockModal">
      <template #content>
        <div class="p-4 space-y-4">
          <h3 class="text-lg font-semibold">Block User?</h3>
          <p class="text-sm text-muted">
            This will reject the request and prevent 
            <strong>{{ selectedRequest?.user?.name }}</strong> 
            from sending future join requests to your agency.
          </p>
          
          <div class="flex gap-2 justify-end">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showBlockModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              @click="handleBlockUser"
            >
              Reject & Block
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>