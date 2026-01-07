<script setup lang="ts">
// ========================================
// Imports & Types
// ========================================

import { onMounted } from 'vue'
import type { AgencyMember } from '~/types/agency'
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
const { fetchAgencyMembers } = useAgencyBrowsing()
const { kickMember } = useAgencyAdmin()

// ========================================
// Component State
// ========================================

const kickingId = ref<number | null>(null)
const showKickModal = ref(false)
const selectedMember = ref<AgencyMember | null>(null)
const kickReason = ref('')

// ========================================
// Computed
// ========================================

const members = computed(() => agencyStore.currentAgency.members)
const loading = computed(() => agencyStore.currentAgency.membersLoading)
const hasMore = computed(() => agencyStore.currentAgency.membersHasMore)

const canKick = (member: AgencyMember): boolean => {
  // Owner can kick anyone except self
  if (agencyStore.isAgencyOwner) {
    return member.role !== 'owner'
  }
  // Admin can kick members only
  if (agencyStore.isAgencyAdmin) {
    return member.role === 'member'
  }
  return false
}

// ========================================
// Event Handlers
// ========================================

function handleShowKickModal(member: AgencyMember): void {
  selectedMember.value = member
  kickReason.value = ''
  showKickModal.value = true
}

async function handleKick(): Promise<void> {
  if (!selectedMember.value) return
  
  kickingId.value = selectedMember.value.id
  await kickMember(selectedMember.value.id, { reason: kickReason.value || undefined })
  kickingId.value = null
  showKickModal.value = false
  selectedMember.value = null
}

function handleLoadMore(): void {
  if (agencyStore.userAgency.agency?.id) {
    fetchAgencyMembers(agencyStore.userAgency.agency.id)
  }
}

// ========================================
// Lifecycle
// ========================================

onMounted(async () => {
  if (agencyStore.userAgency.agency?.id) {
    await fetchAgencyMembers(agencyStore.userAgency.agency.id, true)
  }
})
</script>

<template>
  <main>
    <NavAlt back-to="/agency/my-agency">Agency Members</NavAlt>

    <div class="px-3 pt-14 pb-24">
      <!-- Loading State -->
      <div v-if="loading && members.length === 0" class="space-y-3">
        <div v-for="i in 5" :key="i" class="animate-pulse">
          <div class="flex gap-3 p-3 bg-muted rounded-lg">
            <div class="size-12 bg-muted rounded-full" />
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-muted rounded w-3/4" />
              <div class="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="!loading && members.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center"
      >
        <div class="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <icon name="i-lucide-users" class="size-10 text-primary" />
        </div>
        <h3 class="text-lg font-semibold mb-1">No Members Yet</h3>
        <p class="text-sm text-muted max-w-xs">
          Invite users to join your agency.
        </p>
        <UButton
          v-if="agencyStore.isAgencyAdmin"
          variant="soft"
          color="primary"
          class="mt-4"
          to="/agency/member-invites"
          icon="i-lucide-user-plus"
        >
          Send Invitations
        </UButton>
      </div>

      <!-- Members List -->
      <div v-else class="space-y-3">
        <div
          v-for="member in members"
          :key="member.id"
          class="p-3 bg-linear-to-bl to-neutral-950 border border-neutral-700 rounded-lg relative"
        >
          <!-- Role Badge -->
          <AgencyRoleBadge :role="member.role" class="absolute top-0 right-0" />

          <div class="flex items-center gap-3">
            <!-- Avatar -->
            <UserAvatar
              :img="member.user.avatar || undefined"
              class="w-12 shrink-0"
              animated
            />
            
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold truncate">{{ member.user.name }}</p>
                <p class="text-sm text-muted">
                  @{{ member.user.signature }}
                </p>
              </div>
              
              <p class="text-xs text-muted mt-1">
                Joined {{ formatAgencyDate(member.joined_at, { includeYear: true }) }}
              </p>
            </div>

          </div>

          <!-- Actions -->
          <div v-if="canKick(member)" class="absolute bottom-0 right-0">
            <UButton
                variant="soft"
                color="error"
                size="md"
                icon="i-lucide-user-x"
                @click="handleShowKickModal(member)"
            >
              Kick
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
    </div>

    <!-- Kick Member Modal -->
    <UModal
        v-model:open="showKickModal"
        title="Remove Member"
        description="Are you sure you want to remove this member?"
    >
      <template #content>
        <div class="p-4 space-y-4">
          <h3 class="text-lg font-semibold">Remove Member?</h3>
          <p class="text-sm text-muted">
            Are you sure you want to remove <strong>{{ selectedMember?.user.name }}</strong> from the agency?
          </p>
          
          <UTextarea
            v-model="kickReason"
            placeholder="Reason for removal (optional)"
            :rows="2"
            class="w-full"
          />
          
          <div class="flex gap-2 justify-end">
            <UButton
              variant="soft"
              color="neutral"
              @click="showKickModal = false"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              class="text-error-100"
              :loading="kickingId === selectedMember?.id"
              @click="handleKick"
            >
              Remove Member
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </main>
</template>