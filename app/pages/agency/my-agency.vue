<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, computed } from 'vue'

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
const router = useRouter()
const { leaveAgency, dissolveAgency, fetchUserAgency } = useAgencyMembership()
const { fetchJoinRequests } = useAgencyJoinRequests()
const { fetchSentInvitations } = useAgencyInvitations()

// ========================================
// Component State
// ========================================

const showLeaveModal = ref(false)
const showDissolveModal = ref(false)
const leaveReason = ref('')
const dissolveConfirmName = ref('')
const processing = ref(false)

// ========================================
// Computed
// ========================================

const agency = computed(() => agencyStore.userAgency.agency)
const membership = computed(() => agencyStore.userAgency.membership)
const isOwner = computed(() => agencyStore.isAgencyOwner)
const isAdmin = computed(() => agencyStore.isAgencyAdmin)
const loading = computed(() => agencyStore.userAgency.loading)
const isApproved = computed(() => agency.value?.status === 'approved')


const canDissolve = computed(() => isOwner.value && agency.value?.status === 'approved')

const dissolveConfirmValid = computed(() => 
  dissolveConfirmName.value === agency.value?.name
)

// Transform agency's coin_reseller to the format expected by ChooseDefaultReseller
const agencyCoinReseller = computed(() => {
  if (!agency.value?.coin_reseller) return null
  return {
    id: agency.value.coin_reseller.id,
    name: agency.value.coin_reseller.name,
    avatar: agency.value.coin_reseller.avatar ?? null,
    signature: agency.value.coin_reseller.signature ?? null,
  }
})

// ========================================
// Event Handlers
// ========================================

async function handleLeave(): Promise<void> {
  processing.value = true
  const success = await leaveAgency({ reason: leaveReason.value || undefined })
  processing.value = false
  
  if (success) {
    showLeaveModal.value = false
    router.push('/profile')
  }
}

async function handleDissolve(): Promise<void> {
  if (!dissolveConfirmValid.value) return
  
  processing.value = true
  const success = await dissolveAgency()
  processing.value = false
  
  if (success) {
    showDissolveModal.value = false
    router.push('/profile')
  }
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  await fetchUserAgency()
  
  if (agencyStore.isAgencyAdmin && agencyStore.userAgency.agency?.status === 'approved') {
    fetchJoinRequests()
    fetchSentInvitations()
  }
  
  // Redirect if user has no agency
  if (!agencyStore.userAgency.agency) {
    router.push('/agency/list')
  }
})
</script>

<template>
  <main>
    <NavAlt back-to="/profile">My Agency</NavAlt>

    <!-- Loading State -->
    <div v-if="loading" class="pt-14 px-3 space-y-2">
      <USkeleton class="h-16 rounded-lg" />
      <div class="flex gap-2">
        <USkeleton class="h-12 rounded w-3/4 mx-auto" />
        <USkeleton class="h-12 rounded w-1/2 mx-auto" />
      </div>
    </div>

    <!-- No Agency State -->
    <div
      v-else-if="!agency"
      class="pt-14 px-3 flex flex-col items-center justify-center py-16 text-center"
    >
      <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <UIcon name="i-lucide-building-2" class="size-10 text-primary" />
      </div>
      <h3 class="text-lg font-semibold mb-1">No Agency</h3>
      <p class="text-sm text-muted max-w-xs mb-4">
        You're not part of any agency yet.
      </p>
      <div class="flex gap-2">
        <UButton variant="soft" to="/agency/list">Browse Agencies</UButton>
        <UButton color="primary" to="/agency/create">Create Agency</UButton>
      </div>
    </div>

    <!-- Agency Dashboard -->
    <template v-else>
      <div class="px-3 mt-14">
        <div class="py-3 bg-linear-to-bl to-neutral-950 border border-neutral-700 relative overflow-hidden rounded-lg">
          <NuxtLink :to="`/agency/${agency.id}`" class="grid grid-cols-5 gap-2 px-3">
            <NuxtImg
                :src="agency.logo || `https://api.dicebear.com/7.x/initials/svg?seed=${agency.name}`"
                :alt="agency.name"
                class="w-full aspect-square object-cover col-span-2"
            />

            <!-- Agency Info -->
            <div class="col-span-3 pr-3 my-auto space-y-1">
              <h1 class="text-xl font-bold drop-shadow-md">{{ agency.name }}</h1>
              <!-- Status Badge -->
              <AgencyStatusBadge v-if="agency.status" :status="agency.status" class="absolute top-0 right-0" />

              <div class="flex items-center gap-2">
                <!-- Country -->
                <div class="flex items-center gap-2">
                  <UIcon :name="`i-flag-${agency.country.toLowerCase()}-4x3`" class="size-6 rounded" />
                  <span class="text-sm text-muted">{{ agency.country }}</span>
                </div>

                <!-- Member Count -->
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-users" class="size-5" />
                  <span class="font-semibold">{{ agency.member_count || 0 }} members</span>
                </div>
              </div>

              <!-- Role Badge -->
              <AgencyRoleBadge v-if="isOwner" role="owner" />

              <div v-else-if="membership" class="flex items-center gap-2">
                <AgencyRoleBadge :role="membership.role" />
                <p class="text-xs">Since:</p>
                <p class="text-xs">
                  {{ new Date(membership.joined_at).toLocaleDateString() }}
                </p>
              </div>

            </div>
          </NuxtLink>
        </div>

        <!-- Rejection Notice -->
        <UAlert
          v-if="agency.status === 'rejected' && agency.rejection_note"
          color="error"
          variant="subtle"
          icon="i-lucide-x-circle"
          title="Application Rejected"
          :description="agency.rejection_note"
          class="mx-3 mt-4"
        />

        <!-- Navigation Menu -->
        <div class="mt-4 pb-24">

          <!-- Owner/Admin Management Links -->
          <template v-if="isAdmin && isApproved">
            <SectionTitle class="mb-2">Agency Management</SectionTitle>

            <NavProfileItem
                to="/agency/member-list"
                icon="i-lucide-users"
                txt="Members"
            />
            <NavProfileItem
                to="/agency/member-requests"
                icon="i-lucide-user-plus"
                txt="Join Requests"
                :badge="agencyStore.joinRequests.items.length || undefined"
            />
            <NavProfileItem
                to="/agency/member-invites"
                icon="i-lucide-mail"
                txt="Sent Invitations"
            />
            <NavProfileItem
                to="/agency/member-income"
                icon="i-lucide-dollar-sign"
                txt="Member Targets"
            />
          </template>

          <!-- Owner-Only Settings -->
          <template v-if="isOwner">
            <div class="bg-primary/20 p-3 mt-4 rounded-xl">
              <h2>Agencies Reseller: {{agencyCoinReseller?.name}}</h2>
              <h2>ID: {{agencyCoinReseller?.signature}}</h2>
            </div>

            <!-- Coin Reseller -->
<!--            <EconomyChooseDefaultReseller-->
<!--                agency-mode-->
<!--                :initial-reseller="agencyCoinReseller"-->
<!--                color="primary"-->
<!--                class="mt-14"-->
<!--            />-->

            <!-- Dissolve Agency -->
            <UButton
                v-if="canDissolve"
                variant="soft"
                color="error"
                class="w-full justify-center mt-4"
                icon="i-lucide-trash-2"
                @click="showDissolveModal = true"
            >
              Dissolve Agency
            </UButton>
          </template>

          <!-- Member Actions -->
          <template v-if="!isOwner && membership">
            <UButton
                variant="soft"
                color="error"
                class="w-full justify-center mt-4"
                icon="i-lucide-log-out"
                @click="showLeaveModal = true"
            >
              Leave Agency
            </UButton>
          </template>
        </div>
      </div>
    </template>

    <!-- Leave Agency Modal -->
    <UModal 
      v-model:open="showLeaveModal"
      title="Leave Agency?"
      description="Confirm that you want to leave this agency."
    >
      <template #content>
        <div class="p-4">
          <h3 class="text-lg font-semibold">Leave Agency?</h3>
          <p class="text-sm text-muted">
            Are you sure you want to leave <strong>{{ agency?.name }}</strong>?
            You'll need to request to join again if you change your mind.
          </p>
          
          <UTextarea
            v-model="leaveReason"
            placeholder="Reason for leaving (optional)"
            :rows="2"
            class="w-full my-2"
          />
          
          <div class="flex gap-2 justify-end">
            <UButton
              variant="soft"
              color="neutral"
              @click="showLeaveModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="processing"
              class="text-error-200"
              @click="handleLeave"
            >
              Leave Agency
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Dissolve Agency Modal -->
    <UModal 
      v-model:open="showDissolveModal"
      title="Dissolve Agency?"
      description="This will permanently dissolve your agency and remove all members."
    >
      <template #content>
        <div class="p-4 space-y-4">
          <h3 class="text-lg font-semibold">Dissolve Agency?</h3>
          
          <UAlert
            color="error"
            variant="subtle"
            icon="i-lucide-alert-triangle"
            title="This action cannot be undone"
            description="All members will be removed and the agency will be permanently dissolved."
          />
          
          <p class="text-sm">
            Type <strong>{{ agency?.name }}</strong> to confirm:
          </p>
          
          <UInput
            v-model="dissolveConfirmName"
            :placeholder="agency?.name"
            class="w-full"
          />
          
          <div class="flex gap-2 justify-end">
            <UButton
              variant="soft"
              color="neutral"
              @click="showDissolveModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="processing"
              :disabled="!dissolveConfirmValid"
              @click="handleDissolve"
            >
              Dissolve Agency
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>
