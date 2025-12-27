<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted, computed } from 'vue'
import { AGENCY_STATUS_CONFIG, AGENCY_ROLE_CONFIG } from '~/types/agency'

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

const statusConfig = computed(() => 
  agency.value ? AGENCY_STATUS_CONFIG[agency.value.status] : null
)

const roleConfig = computed(() => {
  if (isOwner.value) return AGENCY_ROLE_CONFIG.owner
  if (membership.value) return AGENCY_ROLE_CONFIG[membership.value.role]
  return null
})

const isApproved = computed(() => agency.value?.status === 'approved')

const canDissolve = computed(() => isOwner.value && isApproved.value)

const dissolveConfirmValid = computed(() => 
  dissolveConfirmName.value === agency.value?.name
)

// ========================================
// Event Handlers
// ========================================

async function handleLeave(): Promise<void> {
  processing.value = true
  const success = await agencyStore.leaveAgency({ reason: leaveReason.value || undefined })
  processing.value = false
  
  if (success) {
    showLeaveModal.value = false
    router.push('/profile')
  }
}

async function handleDissolve(): Promise<void> {
  if (!dissolveConfirmValid.value) return
  
  processing.value = true
  const success = await agencyStore.dissolveAgency()
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
  await agencyStore.fetchUserAgency()
  
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
    <div v-if="loading" class="pt-14 px-3">
      <div class="animate-pulse space-y-4">
        <div class="h-48 bg-muted rounded-lg" />
        <div class="space-y-2">
          <div class="h-12 bg-muted rounded" />
          <div class="h-12 bg-muted rounded" />
          <div class="h-12 bg-muted rounded" />
        </div>
      </div>
    </div>

    <!-- No Agency State -->
    <div
      v-else-if="!agency"
      class="pt-14 px-3 flex flex-col items-center justify-center py-16 text-center"
    >
      <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <icon name="i-lucide-building-2" class="size-10 text-primary" />
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
      <AltHero class="z-20">
        <div class="flex flex-col justify-center min-h-[55vw] bg-gradient-to-br to-primary/30">
          <NuxtLink :to="`/agency/${agency.id}`" class="grid grid-cols-5 gap-2 px-3">
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
              
              <!-- Role Badge -->
              <div
                v-if="roleConfig"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                :class="[
                  roleConfig.color === 'primary' ? 'bg-primary/20 text-primary' : '',
                  roleConfig.color === 'info' ? 'bg-info/20 text-info' : '',
                  roleConfig.color === 'neutral' ? 'bg-muted/20 text-muted' : '',
                ]"
              >
                <icon :name="roleConfig.icon" class="size-3" />
                {{ roleConfig.label }}
              </div>
              
              <!-- Status Badge -->
              <div
                v-if="statusConfig"
                class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ml-1"
                :class="[
                  statusConfig.color === 'success' ? 'bg-success/20 text-success' : '',
                  statusConfig.color === 'warning' ? 'bg-warning/20 text-warning' : '',
                  statusConfig.color === 'error' ? 'bg-error/20 text-error' : '',
                  statusConfig.color === 'neutral' ? 'bg-muted/20 text-muted' : '',
                ]"
              >
                {{ statusConfig.label }}
              </div>
              
              <!-- Country -->
              <div class="flex items-center gap-2">
                <icon :name="`i-flag-${agency.country.toLowerCase()}-4x3`" class="size-6 rounded" />
                <span class="text-sm text-muted">{{ agency.country }}</span>
              </div>
              
              <!-- Member Count -->
              <div class="flex items-center gap-2">
                <icon name="i-lucide-users" class="size-5" />
                <span class="font-semibold">{{ agency.member_count || 0 }} members</span>
              </div>
            </div>
          </NuxtLink>
        </div>
      </AltHero>

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
      <div class="px-3 mt-4 pb-24">
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
        </template>

        <!-- Owner-Only Settings -->
        <template v-if="isOwner">
          <SectionTitle class="mb-2 mt-6">Agency Settings</SectionTitle>
          
          <!-- Coin Reseller -->
          <div class="p-3 bg-elevated rounded-lg mb-2">
            <div class="flex items-center justify-between">
              <div>
                <p class="font-semibold">Coin Reseller</p>
                <p class="text-sm text-muted">
                  {{ agency.coin_reseller?.name || 'Not set' }}
                </p>
              </div>
              <UButton
                variant="soft"
                size="sm"
                icon="i-lucide-edit"
              >
                Change
              </UButton>
            </div>
          </div>

          <!-- Dissolve Agency -->
          <UButton
            v-if="canDissolve"
            variant="outline"
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
          <SectionTitle class="mb-2 mt-6">Membership</SectionTitle>
          
          <div class="p-3 bg-elevated rounded-lg mb-2">
            <p class="text-sm text-muted">Member since</p>
            <p class="font-semibold">
              {{ new Date(membership.joined_at).toLocaleDateString() }}
            </p>
          </div>

          <UButton
            variant="outline"
            color="error"
            class="w-full justify-center mt-4"
            icon="i-lucide-log-out"
            @click="showLeaveModal = true"
          >
            Leave Agency
          </UButton>
        </template>
      </div>
    </template>

    <!-- Leave Agency Modal -->
    <UModal v-model:open="showLeaveModal">
      <template #content>
        <div class="p-4 space-y-4">
          <h3 class="text-lg font-semibold">Leave Agency?</h3>
          <p class="text-sm text-muted">
            Are you sure you want to leave <strong>{{ agency?.name }}</strong>?
            You'll need to request to join again if you change your mind.
          </p>
          
          <UTextarea
            v-model="leaveReason"
            placeholder="Reason for leaving (optional)"
            :rows="2"
          />
          
          <div class="flex gap-2 justify-end">
            <UButton
              variant="ghost"
              color="neutral"
              @click="showLeaveModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="processing"
              @click="handleLeave"
            >
              Leave Agency
            </UButton>
          </div>
        </div>
      </template>
    </UModal>

    <!-- Dissolve Agency Modal -->
    <UModal v-model:open="showDissolveModal">
      <template #content>
        <div class="p-4 space-y-4">
          <h3 class="text-lg font-semibold text-error">Dissolve Agency?</h3>
          
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
          />
          
          <div class="flex gap-2 justify-end">
            <UButton
              variant="ghost"
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
