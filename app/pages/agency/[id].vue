<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { AGENCY_STATUS_CONFIG } from '~/types/agency'

// ========================================
// Page Configuration
// ========================================

definePageMeta({ layout: 'alt' })

// ========================================
// Composables / Injected Dependencies
// ========================================

const route = useRoute()
const agencyStore = useAgencyStore()
const _authStore = useAuthStore() // Keep for future features

// ========================================
// Component State
// ========================================

const agencyId = computed(() => Number(route.params.id))
const joiningAgency = ref(false)
const cancellingRequest = ref(false)
const joinMessage = ref('')
const showJoinModal = ref(false)

// ========================================
// Computed
// ========================================

const agency = computed(() => agencyStore.currentAgency.agency)
const members = computed(() => agencyStore.currentAgency.members)
const loading = computed(() => agencyStore.currentAgency.loading)
const error = computed(() => agencyStore.currentAgency.error)

const _statusConfig = computed(() => 
  agency.value ? AGENCY_STATUS_CONFIG[agency.value.status] : null
)

const isOwnAgency = computed(() => 
  agencyStore.userAgency.agency?.id === agencyId.value
)

const isApproved = computed(() => agency.value?.status === 'approved')

const canJoin = computed(() => 
  !agencyStore.isAgencyMember && 
  isApproved.value && 
  !hasPendingRequest.value
)

const hasPendingRequest = computed(() => 
  agencyStore.myJoinRequests.items.some(r => r.agency?.id === agencyId.value && r.status === 'pending')
)

const _pendingRequest = computed(() =>
  agencyStore.myJoinRequests.items.find(r => r.agency?.id === agencyId.value && r.status === 'pending')
)

// ========================================
// Event Handlers
// ========================================

async function handleJoinRequest(): Promise<void> {
  joiningAgency.value = true
  const result = await agencyStore.requestToJoin(agencyId.value, { message: joinMessage.value || undefined })
  joiningAgency.value = false
  
  if (result) {
    showJoinModal.value = false
    joinMessage.value = ''
  }
}

async function handleCancelRequest(): Promise<void> {
  cancellingRequest.value = true
  await agencyStore.cancelJoinRequest(agencyId.value)
  cancellingRequest.value = false
}

function handleLoadMoreMembers(): void {
  agencyStore.fetchAgencyMembers(agencyId.value)
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  await agencyStore.fetchAgencyById(agencyId.value)
  await agencyStore.fetchAgencyMembers(agencyId.value, true)
  
  // Fetch user's join requests if not a member
  if (!agencyStore.isAgencyMember) {
    await agencyStore.fetchMyJoinRequests(true)
  }
})


</script>

<template>
  <main>
    <NavAlt back-to="/agency/list">Agency</NavAlt>

    <!-- Loading State -->
    <div v-if="loading" class="pt-14 px-3">
      <div class="animate-pulse space-y-4">
        <div class="h-48 bg-muted rounded-lg" />
        <div class="h-6 bg-muted rounded w-3/4" />
        <div class="h-4 bg-muted rounded w-1/2" />
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="pt-14 px-3">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-alert-circle"
        :title="error"
      />
    </div>

    <!-- Agency Content -->
    <template v-else-if="agency">
      <AltHero class="z-20">
        <div class="flex flex-col justify-center min-h-[55vw] bg-gradient-to-br to-primary/30">
          <div class="grid grid-cols-5 gap-2 px-3">
            <!-- Agency Logo -->
            <div class="col-span-2">
              <NuxtImg
                :src="agency.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${agency.name}`"
                :alt="agency.name"
                class="w-full aspect-square rounded-lg border-2 border-primary object-cover"
              />
            </div>
            
            <!-- Agency Info -->
            <div class="col-span-3 pr-3 my-auto space-y-1">
              <h1 class="text-lg font-bold">{{ agency.name }}</h1>
              
              <!-- Status Badge -->
              <AgencyStatusBadge v-if="agency.status" :status="agency.status" />
              
              <!-- Country -->
              <div class="flex items-center gap-2">
                <icon :name="`i-flag-${agency.country.toLowerCase()}-4x3`" class="size-6 rounded" />
                <span class="text-sm text-muted">{{ agency.country }}</span>
              </div>
              
              <!-- Member Count -->
              <div class="flex items-center gap-2">
                <icon name="i-lucide-users" class="size-5" />
                <span class="font-semibold">{{ agency.member_count || members.length }} members</span>
              </div>
            </div>
          </div>
        </div>
      </AltHero>

      <div class="px-3 mt-4 pb-24">
        <!-- Owner Info -->
        <div v-if="agency.owner" class="flex items-center gap-3 p-3 bg-elevated rounded-lg mb-4">
          <UserAvatar
            :img="agency.owner.avatar || undefined"
            class="w-12"
          />
          <div>
            <p class="text-xs text-muted">Owner</p>
            <p class="font-semibold">{{ agency.owner.name }}</p>
            <p v-if="agency.owner.signature" class="text-sm text-muted">@{{ agency.owner.signature }}</p>
          </div>
        </div>

        <!-- Coin Reseller Info -->
        <div v-if="agency.coin_reseller" class="flex items-center gap-3 p-3 bg-elevated rounded-lg mb-4">
          <UserAvatar
            :img="agency.coin_reseller.avatar || undefined"
            class="w-12"
          />
          <div>
            <p class="text-xs text-muted">Coin Reseller</p>
            <p class="font-semibold">{{ agency.coin_reseller.name }}</p>
            <p v-if="agency.coin_reseller.signature" class="text-sm text-muted">@{{ agency.coin_reseller.signature }}</p>
          </div>
        </div>

        <!-- Join / Cancel Action -->
        <div v-if="!isOwnAgency && isApproved" class="mb-6">
          <!-- Can Join -->
          <UButton
            v-if="canJoin"
            color="primary"
            size="lg"
            class="w-full justify-center"
            icon="i-lucide-user-plus"
            @click="showJoinModal = true"
          >
            Request to Join
          </UButton>
          
          <!-- Has Pending Request -->
          <div v-else-if="hasPendingRequest" class="space-y-2">
            <UAlert
              color="info"
              variant="subtle"
              icon="i-lucide-clock"
              title="Request Pending"
              description="Your join request is awaiting approval."
            />
            <UButton
              variant="outline"
              color="error"
              size="md"
              class="w-full justify-center"
              icon="i-lucide-x"
              :loading="cancellingRequest"
              @click="handleCancelRequest"
            >
              Cancel Request
            </UButton>
          </div>
          
          <!-- Already a Member of Another Agency -->
          <UAlert
            v-else-if="agencyStore.isAgencyMember"
            color="warning"
            variant="subtle"
            icon="i-lucide-info"
            title="Already in an Agency"
            description="You must leave your current agency before joining another."
          />
        </div>

        <!-- Navigate to Own Agency -->
        <UButton
          v-if="isOwnAgency"
          color="primary"
          variant="soft"
          size="lg"
          class="w-full justify-center mb-6"
          icon="i-lucide-settings"
          to="/agency/my-agency"
        >
          Manage My Agency
        </UButton>

        <!-- Members Section -->
        <SectionTitle class="mb-3">Agency Members</SectionTitle>
        
        <div class="flex flex-col gap-3">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center gap-3 p-3 bg-elevated rounded-lg"
          >
            <UserAvatar
              :img="member.user.avatar || undefined"
              class="w-12"
            />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-semibold truncate">{{ member.user.name }}</p>
                <!-- Role Badge -->
                <AgencyRoleBadge :role="member.role" />
              </div>
              <p v-if="member.user.signature" class="text-sm text-muted">@{{ member.user.signature }}</p>
            </div>
          </div>
        </div>

        <!-- Load More Members -->
        <div
          v-if="agencyStore.currentAgency.membersHasMore"
          class="flex justify-center pt-4"
        >
          <UButton
            variant="soft"
            color="primary"
            :loading="agencyStore.currentAgency.membersLoading"
            @click="handleLoadMoreMembers"
          >
            Load More
          </UButton>
        </div>

        <!-- Empty Members -->
        <div
          v-if="!agencyStore.currentAgency.membersLoading && members.length === 0"
          class="text-center py-8 text-muted"
        >
          <icon name="i-lucide-users" class="size-10 mx-auto mb-2 opacity-50" />
          <p>No members yet</p>
        </div>
      </div>
    </template>

    <!-- Join Request Modal -->
    <UModal v-model:open="showJoinModal">
      <template #content>
        <div class="p-4 space-y-4">
          <h3 class="text-lg font-semibold">Request to Join {{ agency?.name }}</h3>
          <p class="text-sm text-muted">
            Your request will be reviewed by the agency owner or admins.
          </p>
          
          <UTextarea
            v-model="joinMessage"
            placeholder="Add an optional message... (e.g., why you want to join)"
            :rows="3"
          />
          
          <div class="flex gap-2 justify-end">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showJoinModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="primary"
              :loading="joiningAgency"
              @click="handleJoinRequest"
            >
              Send Request
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>