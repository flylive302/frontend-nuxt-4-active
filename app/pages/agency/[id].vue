<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'
import { withImageKitTransform } from '~/utils/imagekit'

// ========================================
// Page Configuration
// ========================================

definePageMeta({
  layout: 'alt',
  middleware: 'auth',
  validate: route => /^\d+$/.test(String(route.params.id)),
})

// ========================================
// Composables / Injected Dependencies
// ========================================

const route = useRoute()
const agencyStore = useAgencyStore()
const { fetchAgencyById, fetchAgencyMembers } = useAgencyBrowsing()
const { requestToJoin, cancelJoinRequest, fetchMyJoinRequests } = useAgencyJoinRequests()
const { fetchUserAgency } = useAgencyMembership()

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


// ========================================
// Event Handlers
// ========================================

async function handleJoinRequest(): Promise<void> {
  joiningAgency.value = true
  const result = await requestToJoin(agencyId.value, { message: joinMessage.value || undefined })
  joiningAgency.value = false
  
  if (result) {
    showJoinModal.value = false
    joinMessage.value = ''
  }
}

async function handleCancelRequest(): Promise<void> {
  cancellingRequest.value = true
  await cancelJoinRequest(agencyId.value)
  cancellingRequest.value = false
}

function handleLoadMoreMembers(): void {
  fetchAgencyMembers(agencyId.value)
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  // These three are independent — the user's agency context does not gate
  // fetching the viewed agency. Awaiting them serially made the page wait on a
  // full round-trip chain (Sentry: consecutive-HTTP on /agency/:id).
  await Promise.all([
    fetchUserAgency(),
    fetchAgencyById(agencyId.value),
    fetchAgencyMembers(agencyId.value, true),
  ])

  // Stays sequential: membership is only known after fetchUserAgency resolves.
  if (!agencyStore.isAgencyMember) {
    await fetchMyJoinRequests(true)
  }
})


</script>

<template>
  <main>
    <NavAlt spacer back-to="/agency/list">Agency</NavAlt>

    <!-- Loading State -->
    <div v-if="loading" class="pt-14 px-3 space-y-2">
      <USkeleton class="h-48 rounded-lg" />
      <USkeleton class="h-6 rounded w-3/4 mx-auto" />
      <USkeleton class="h-4 rounded w-1/2 mx-auto" />
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
      <div class="px-3 mt-14">
        <div class="py-3 bg-linear-to-bl to-neutral-950 border border-neutral-700 relative overflow-hidden rounded-lg">
          <div class="grid grid-cols-5 gap-2 px-3">
            <!-- Agency Logo -->
            <NuxtImg
              :src="withImageKitTransform(agency.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${agency.name}`, { w: 256 })"
              :alt="agency.name"
              class="w-full aspect-square object-cover col-span-2"
            />

            <!-- Agency Info -->
            <div class="col-span-3 my-auto space-y-1">
              <h1 class="text-xl font-bold drop-shadow-md">{{ agency.name }}</h1>
              <!-- Status Badge -->
              <AgencyStatusBadge v-if="agency.status" class="absolute top-0 right-0" :status="agency.status" />

              <div class="flex items-center gap-2">
                <!-- Country -->
                <div class="flex items-center gap-2">
                  <CountryFlag :code="agency.country" class="size-6 rounded" />
                  <span class="text-white font-semibold">{{ agency.country }}</span>
                </div>

                <!-- Member Count -->
                <div class="flex items-center gap-2">
                  <icon name="i-lucide-users" class="size-5" />
                  <span class="font-semibold">{{ agency.member_count || members.length }} Members</span>
                </div>
              </div>

              <!-- Join / Cancel Action -->
              <div v-if="!isOwnAgency && isApproved" class="mt-3">
                <!-- Can Join -->
                <UButton
                    v-if="canJoin" color="primary" size="xs" class="justify-center" icon="i-lucide-user-plus"
                    @click="showJoinModal = true"
                >
                  Request to Join
                </UButton>
              </div>

              <!-- Navigate to Own Agency -->
              <UButton
                  v-if="isOwnAgency" color="neutral" variant="subtle" size="sm" class="justify-center mt-3"
                  icon="i-lucide-settings" to="/agency/my-agency"
              >
                Manage My Agency
              </UButton>
            </div>
          </div>
        </div>

        <div v-if="!isOwnAgency" class="my-3 px-3">
          <!-- Already a Member of Another Agency -->
          <UAlert
              v-if="agencyStore.isAgencyMember" color="warning" variant="subtle" icon="i-lucide-info"
              title="Already in an Agency" description="You must leave your current agency before joining another."
          />
          <!-- Has Pending Request -->
          <div v-else-if="hasPendingRequest" class="space-y-2">
            <UAlert
                color="info" variant="subtle" icon="i-lucide-clock" title="Request Pending"
                description="Your join request is awaiting approval."
            />
            <UButton
                variant="soft" color="error" size="xs" class="w-full justify-center" icon="i-lucide-x"
                :loading="cancellingRequest" @click="handleCancelRequest"
            >
              Cancel Request
            </UButton>
          </div>
        </div>

        <div class="flex gap-2 w-full my-3">

          <!-- Owner Info -->
          <NuxtLink v-if="agency.owner" :to="`/profile/` + agency.owner.signature" class="flex items-center p-2 bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg w-full relative overflow-hidden">
            <!-- Role Badge -->
            <AgencyRoleBadge class="absolute top-0 right-0 z-0 p-1 " :role="`owner`" />

            <UserAvatar :img="agency.owner.avatar ?? undefined" :animated="true" class="w-14" />
            <div class="relative mt-3">
              <p class="font-semibold">{{ agency.owner.name }}</p>
              <p class="text-sm text-muted">ID: {{ agency.owner.signature }}</p>
            </div>
          </NuxtLink>

          <!-- Coin Reseller Info -->
          <NuxtLink v-if="agency.coin_reseller" :to="`/profile/` + agency.coin_reseller.signature" class="flex items-center p-2 bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg w-full relative overflow-hidden">
            <div class="absolute top-0 right-0 z-0 px-1.5 py-0.5 rounded text-xs font-semibold inline-flex items-center gap-1 shrink-0 bg-tertiary/30 text-tertiary">
              <Icon name="i-lucide-coins" />
              <p>Coin Reseller</p>
            </div>

            <UserAvatar :img="agency.coin_reseller.avatar ?? undefined" :animated="true" class="w-14" />
            <div class="relative mt-3">
              <p class="font-semibold">{{ agency.coin_reseller.name }}</p>
              <p v-if="agency.coin_reseller.signature" class="text-sm text-muted">ID: {{ agency.coin_reseller.signature }}
              </p>
            </div>
          </NuxtLink>
        </div>

        <!-- Members Section -->
        <SectionTitle class="mb-3">Agency Members</SectionTitle>

        <div class="flex flex-col gap-3">
          <NuxtLink
              v-for="member in members"
              :key="member.id"
              :to="`/profile/` + member.user.signature"
              class="flex gap-1 bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg shadow-md shadow-neutral-900 overflow-hidden relative p-1"
          >
            <UserAvatar
                :img="member.user.avatar ?? undefined"
                :animated="true"
                class="w-13"
            />
            <!-- Role Badge -->
            <AgencyRoleBadge :role="member.role" class="absolute top-0 right-0" />
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="font-semibold truncate">{{ member.user.name }}</p>
                <UBadge icon="i-lucide-mars" class="text-white" variant="subtle" />
              </div>
              <p v-if="member.user.signature" class="text-sm text-muted">@{{ member.user.signature }}</p>
            </div>
          </NuxtLink>
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
            class="w-full"
            placeholder="Add an optional message... (e.g., why you want to join)"
            :rows="3"
          />
          
          <div class="flex gap-2 justify-end">
            <UButton
              variant="subtle"
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