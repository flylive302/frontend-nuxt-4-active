<script setup lang="ts">
// ========================================
// Participant Profile Modal
// ========================================
//
// Modal showing participant info with admin actions dropdown.
// Triggered when clicking a user from participants list.
// ========================================

import type { RoomParticipant } from '~/types/room/audio'
import type { BlockUserRequest } from '~/types/room/room'
import type { BlockDurationValue } from '~/constants/room'
import KickDurationPopover from '~/components/room/kick-duration-popover.vue'

// ========================================
// Props
// ========================================

const props = defineProps<{
  participant: RoomParticipant | null
  roomId: number
}>()

// ========================================
// Emits
// ========================================

const emit = defineEmits<{
  close: []
  memberUpdated: []
}>()

// ========================================
// State
// ========================================

const open = defineModel<boolean>('open', { default: false })
const loading = ref(false)

// ========================================
// Stores
// ========================================

const authStore = useAuthStore()
const userBlocksStore = useUserBlocksStore()

// ========================================
// Composables
// ========================================

const { updateMemberRole } = useRoomMemberActions()
const { blockUser } = useRoomBlocking()
const { blockUser: blockUserProfile, unblockUser: unblockUserProfile } = useUserBlocking()

// ========================================
// Computed
// ========================================

/** Current user is room owner */
const { isRoomOwner } = useRoomPermissions()

/** Rank rules for this room — who outranks whom (owner > admin > member). */
const { canModerate, canRemove, rankOf } = useRoomHierarchy()

/** Current user can manage members (owner or admin) */
const canManageMembers = canModerate

/** Is viewing own profile */
const isOwnProfile = computed(() => {
  return props.participant?.id === authStore.user?.id
})

/** Show admin actions (not for own profile, must have permission) */
const showAdminActions = computed(() => {
  return canManageMembers.value && !isOwnProfile.value && props.participant
})

/** Get a participant's current role */
const participantRole = computed(() => rankOf(props.participant?.id))

/** Apple 1.2 — report/block are for any regular viewer looking at someone else,
 *  not gated behind admin permission. */
const showUserSafetyActions = computed(() => !isOwnProfile.value && !!props.participant)

const isParticipantBlocked = computed(() =>
  userBlocksStore.isBlocked(props.participant?.id)
)

/** Kicking is rank-gated — an admin cannot kick the owner or another admin. */
const canKickParticipant = computed(() => canRemove(props.participant?.id))

/** Can promote to admin (not owner, currently member) */
const canPromote = computed(() => {
  return participantRole.value === 'member' && isRoomOwner.value
})

/** Can demote from admin (not owner, currently admin) */
const canDemote = computed(() => {
  return participantRole.value === 'admin' && isRoomOwner.value
})

// ========================================
// Dropdown Items
// ========================================

const adminActions = computed(() => {
  if (!showAdminActions.value) return []

  // Role management section (owner only). Kick/block is a separate
  // KickDurationPopover-triggered button (unified kick path, ADR 0017) —
  // not a dropdown item, since it always requires a duration choice.
  if (!isRoomOwner.value) return []

  const roleItems = []
  if (canPromote.value) {
    roleItems.push({
      label: 'Promote to Admin',
      icon: 'i-lucide-shield-plus',
      click: handlePromote,
    })
  }
  if (canDemote.value) {
    roleItems.push({
      label: 'Demote to Member',
      icon: 'i-lucide-shield-minus',
      click: handleDemote,
    })
  }

  return roleItems.length > 0 ? [roleItems] : []
})

// ========================================
// Handlers
// ========================================

/**
 * Kick (= block with a duration) the participant. Unified kick path (ADR
 * 0017): there is no duration-less kick — every call carries one of the six
 * canonical BlockDuration values selected from the duration popover.
 */
async function handleKick(duration: BlockDurationValue) {
  if (!props.participant) return

  loading.value = true
  try {
    const request: BlockUserRequest = {
      user_id: props.participant.id,
      duration,
    }
    const success = await blockUser(props.roomId, request)
    if (success) {
      emit('memberUpdated')
      open.value = false
    }
  } finally {
    loading.value = false
  }
}

async function handlePromote() {
  if (!props.participant) return

  loading.value = true
  try {
    const success = await updateMemberRole(props.roomId, props.participant.id, { role: 'admin' })
    if (success) {
      emit('memberUpdated')
    }
  } finally {
    loading.value = false
  }
}

async function handleDemote() {
  if (!props.participant) return

  loading.value = true
  try {
    const success = await updateMemberRole(props.roomId, props.participant.id, { role: 'member' })
    if (success) {
      emit('memberUpdated')
    }
  } finally {
    loading.value = false
  }
}

// ========================================
// Report / Block (Apple 1.2)
// ========================================

const showReportModal = ref(false)
const showBlockConfirm = ref(false)
const blockActionLoading = ref(false)

function handleOpenReport() {
  showReportModal.value = true
}

function handleReportSubmitted() {
  showReportModal.value = false
}

function handleBlockButtonClick() {
  if (isParticipantBlocked.value) {
    handleUnblock()
    return
  }
  showBlockConfirm.value = true
}

async function handleConfirmBlock() {
  if (!props.participant) return
  blockActionLoading.value = true
  try {
    await blockUserProfile(props.participant.id)
  } finally {
    blockActionLoading.value = false
    showBlockConfirm.value = false
  }
}

async function handleUnblock() {
  if (!props.participant) return
  blockActionLoading.value = true
  try {
    await unblockUserProfile(props.participant.id)
  } finally {
    blockActionLoading.value = false
  }
}
</script>

<template>
  <UDrawer v-model:open="open" title="User Profile" description="View user information and actions.">
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-3 pb-4">

        <!-- User Profile Card (matching seat-drawer style) -->
        <div v-if="participant" class="rounded-xl p-4 shadow-sm border border-white/10 bg-elevated/50 relative overflow-hidden">
          <!-- Background decoration -->
          <div class="absolute -right-6 -top-6 size-24 bg-primary/20 blur-2xl rounded-full pointer-events-none animate-pulse" />
          <div class="absolute -left-6 -bottom-6 size-24 bg-primary/20 blur-2xl rounded-full pointer-events-none animate-pulse" />

          <div class="flex flex-col items-center text-center relative z-10">
            <LazyUserAvatar :img="participant.avatar ?? undefined" :frame-id="participant.frame_id" :user-name="participant.name" :animated="true" class="size-24" />

            <h3 class="text-xl font-bold mt-2">{{ participant.name }}</h3>

            <div class="flex items-center gap-2 mt-1">
              <ProfileBadge v-if="participant.signature" :show-badge="false" :txt="participant.signature" />
              <UBadge 
                color="secondary" 
                :icon="getGenderInfo(participant.gender).icon" 
                size="sm"
                class="w-fit text-white p-1"
              >
                {{ getAge(participant.date_of_birth) }}
              </UBadge>
              <CountryFlag
                v-if="participant.country"
                :code="participant.country"
                class="rounded overflow-hidden h-6 size-8 shadow-lg"
              />
            </div>

            <!-- Role Badge -->
            <UBadge 
              v-if="participantRole === 'owner'" 
              color="warning" 
              variant="subtle" 
              class="mt-2"
              icon="i-lucide-crown"
            >
              Room Owner
            </UBadge>
            <UBadge 
              v-else-if="participantRole === 'admin'" 
              color="info" 
              variant="subtle" 
              class="mt-2"
              icon="i-lucide-shield"
            >
              Admin
            </UBadge>
          </div>
        </div>

        <!-- View Profile Button -->
        <UButton
          v-if="participant?.signature"
          :to="`/profile/${participant.signature}`"
          icon="i-lucide-user"
          color="primary"
          variant="soft"
          class="w-full justify-center"
          @click="() => { open = false }"
        >
          View Full Profile
        </UButton>

        <!-- Report / Block (Apple 1.2) — visible to any regular member
             looking at someone else, not gated behind admin permission. -->
        <div v-if="showUserSafetyActions" class="flex gap-2">
          <UButton
            icon="i-lucide-flag"
            color="warning"
            variant="soft"
            class="flex-1 justify-center"
            @click="handleOpenReport"
          >
            Report User
          </UButton>
          <UButton
            :icon="isParticipantBlocked ? 'i-lucide-user-check' : 'i-lucide-user-x'"
            :color="isParticipantBlocked ? 'neutral' : 'error'"
            variant="soft"
            class="flex-1 justify-center"
            :loading="blockActionLoading"
            @click="handleBlockButtonClick"
          >
            {{ isParticipantBlocked ? 'Unblock User' : 'Block User' }}
          </UButton>
        </div>

        <ReportModal
          v-if="participant"
          v-model:open="showReportModal"
          reportable-type="user"
          :reportable-id="participant.id"
          @submitted="handleReportSubmitted"
        />

        <!-- Block confirmation — explains the effect before committing. -->
        <UModal
          v-model:open="showBlockConfirm"
          title="Block this user?"
          :ui="{ content: 'bg-neutral-900 border border-white/10' }"
        >
          <template #body>
            <p class="text-sm text-neutral-400">
              You won't see their messages. They can still see the room.
            </p>
          </template>
          <template #footer>
            <div class="flex gap-3 w-full">
              <UButton variant="ghost" color="neutral" class="flex-1" @click="() => { showBlockConfirm = false }">
                Cancel
              </UButton>
              <UButton color="error" class="flex-1" :loading="blockActionLoading" @click="handleConfirmBlock">
                Block
              </UButton>
            </div>
          </template>
        </UModal>

        <!-- Kick — unified kick path (ADR 0017): duration popup, no duration-less kick.
             Rank-gated: never shown for the owner, and never shown to an admin
             looking at another admin. -->
        <KickDurationPopover
          v-if="showAdminActions && canKickParticipant"
          @select="handleKick"
        >
          <UButton
            icon="i-lucide-log-out"
            color="error"
            variant="soft"
            class="w-full justify-center"
            :loading="loading"
          >
            Kick from Room
          </UButton>
        </KickDurationPopover>

        <!-- Admin Actions Dropdown (role management) -->
        <UDropdownMenu
          v-if="showAdminActions && adminActions.length > 0"
          :items="adminActions"
        >
          <UButton
            icon="i-lucide-more-horizontal"
            color="neutral"
            variant="soft"
            class="w-full justify-center"
            :loading="loading"
          >
            Member Actions
          </UButton>
        </UDropdownMenu>

        <!-- Close Button -->
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-x"
          class="justify-center mt-2"
          @click="() => { open = false }"
        >
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
