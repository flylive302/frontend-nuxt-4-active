<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted } from 'vue'

// ========================================
// Imports from Utils
// ========================================

import { formatAgencyDate, getJoinRequestStatusColor } from '~/utils/agency-format'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt', middleware: 'auth' })

// ========================================
// Composables / Injected Dependencies
// ========================================

const agencyStore = useAgencyStore()
const { cancelJoinRequest, fetchMyJoinRequests } = useAgencyJoinRequests()

// ========================================
// Component State
// ========================================

const cancellingId = ref<number | null>(null)

// ========================================
// Event Handlers
// ========================================

async function handleCancel(agencyId: number): Promise<void> {
  cancellingId.value = agencyId
  await cancelJoinRequest(agencyId)
  cancellingId.value = null
}

// ========================================
// Lifecycle
// ========================================

onMounted(() => {
  fetchMyJoinRequests(true)
})

// ========================================
// Computed
// ========================================

const pendingRequests = computed(() =>
  agencyStore.myJoinRequests.items.filter(r => r.status === 'pending')
)

const processedRequests = computed(() =>
  agencyStore.myJoinRequests.items.filter(r => r.status !== 'pending')
)
</script>

<template>
  <main>
    <NavAlt back-to="/profile">My Join Requests</NavAlt>

    <div class="px-3 pt-14 pb-24">
      <!-- Loading State -->
      <div v-if="agencyStore.myJoinRequests.loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div class="p-4 bg-elevated rounded-lg space-y-3">
            <div class="flex gap-3">
              <div class="size-12 bg-muted rounded-lg" />
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
        v-else-if="agencyStore.myJoinRequests.items.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-user-plus" class="size-10 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-1">No Requests</h3>
        <p class="text-sm text-muted max-w-xs">
          When you request to join an agency, your requests will appear here.
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

      <!-- Requests List -->
      <div v-else class="space-y-6">
        <!-- Pending Requests -->
        <div v-if="pendingRequests.length > 0">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            Pending
          </h3>
          <div class="space-y-3">
            <div
              v-for="request in pendingRequests"
              :key="request.id"
              class="p-4 bg-elevated rounded-lg border border-warning/30"
            >
              <!-- Agency Info -->
              <NuxtLink
                :to="`/agency/${request.agency?.id}`"
                class="flex gap-3 mb-3"
              >
                <NuxtImg
                  :src="request.agency?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${request.agency?.name}`"
                  :alt="request.agency?.name"
                  class="size-12 rounded-lg object-cover border border-muted"
                />
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold truncate">{{ request.agency?.name }}</h3>
                  <div class="flex items-center gap-2 text-sm text-muted">
                    <icon :name="`i-flag-${request.agency?.country.toLowerCase()}-4x3`" class="size-4 rounded" />
                    <span>{{ request.agency?.country }}</span>
                  </div>
                </div>
              </NuxtLink>

              <!-- Request Message -->
              <p v-if="request.message" class="text-sm text-muted mb-2 italic">
                "{{ request.message }}"
              </p>

              <!-- Submitted Date -->
              <p class="text-xs text-muted mb-3">
                Submitted {{ formatAgencyDate(request.created_at, { includeYear: true }) }}
              </p>

              <!-- Cancel Action -->
              <UButton
                v-if="request.can_be_cancelled"
                variant="outline"
                color="error"
                class="w-full justify-center"
                :loading="cancellingId === request.agency?.id"
                @click="handleCancel(request.agency?.id || 0)"
              >
                Cancel Request
              </UButton>
            </div>
          </div>
        </div>

        <!-- Processed Requests -->
        <div v-if="processedRequests.length > 0">
          <h3 class="text-sm font-semibold text-muted uppercase tracking-wide mb-3">
            History
          </h3>
          <div class="space-y-3">
            <div
              v-for="request in processedRequests"
              :key="request.id"
              class="p-4 bg-elevated rounded-lg border border-muted/30 opacity-75"
            >
              <!-- Agency Info -->
              <div class="flex gap-3 mb-2">
                <NuxtImg
                  :src="request.agency?.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${request.agency?.name}`"
                  :alt="request.agency?.name"
                  class="size-10 rounded-lg object-cover border border-muted"
                />
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold truncate text-sm">{{ request.agency?.name }}</h3>
                  <div class="flex items-center gap-2">
                    <UBadge :color="getJoinRequestStatusColor(request.status)" size="xs">
                      {{ request.status_label }}
                    </UBadge>
                    <span class="text-xs text-muted">{{ formatAgencyDate(request.created_at, { includeYear: true }) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <UAlert
        v-if="agencyStore.myJoinRequests.error"
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="agencyStore.myJoinRequests.error"
        class="mt-4"
      />
    </div>
  </main>
</template>
