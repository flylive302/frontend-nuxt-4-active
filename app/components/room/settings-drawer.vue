<script setup lang="ts">
// ========================================
// Room Settings Drawer
// ========================================
//
// Accessible via gear icon in room header.
// Contains role-based actions:
// - Owner/Admin: Manage Members, Invite User
// - Members: View Info, Leave Room
// - Non-members: Request to Join, Accept/Decline Invite
// ========================================

// ========================================
// State
// ========================================

const open = defineModel<boolean>('open', { default: false })
const showMembersPanel = ref(false)
const showInviteModal = ref(false)

// ========================================
// Stores & Composables
// ========================================

const roomStore = useRoomStore()
const { requestToJoin, cancelJoinRequest, myJoinRequests } = useRoomJoinRequests()
const { acceptInvitation, declineInvitation, receivedInvitations, fetchReceivedInvitations } = useRoomInvitations()
const { myMembership, fetchMyMembership, leaveRoomMembership } = useRoomMembers()

// ========================================
// Computed
// ========================================

const thisRoom = computed(() => roomStore.currentRoom)

/** Current user is room owner */
const isRoomOwner = computed(() => roomStore.isRoomOwner)

/** Current user can manage members (owner or admin) */
const canManageMembers = computed(() => {
  // Owner can always manage
  if (isRoomOwner.value) return true
  // Admin members can also manage
  if (myMembership.value?.role === 'admin') return true
  return false
})

/** Membership state for current user */
const membershipState = computed(() => {
  if (!thisRoom.value) return 'none'
  
  const roomId = thisRoom.value.id
  
  // Owner is always a member
  if (isRoomOwner.value) return 'owner'
  
  // Check actual membership from API
  // If myMembership exists, user is a member of the current room
  if (myMembership.value) {
    return myMembership.value.role === 'admin' ? 'admin' : 'member'
  }
  
  // Check if we have a pending join request for this room
  const pendingRequest = myJoinRequests.value.items.find(
    (r) => r && (r.room_id === roomId || r.room?.id === roomId) && r.status === 'pending'
  )
  if (pendingRequest) return 'pending_request'
  
  // Check if we have a pending invitation for this room
  const pendingInvite = receivedInvitations.value.items.find(
    (inv) => inv && (inv.room?.id === roomId) && inv.status === 'pending'
  )
  if (pendingInvite) return 'has_invitation'
  
  return 'none'
})

/** Get pending invitation ID */
const pendingInvitationId = computed(() => {
  if (!thisRoom.value) return undefined
  const roomId = thisRoom.value.id
  const pendingInvite = receivedInvitations.value.items.find(
    (inv) => inv && (inv.room?.id === roomId) && inv.status === 'pending'
  )
  return pendingInvite?.id
})

/** Loading state for actions */
const actionLoading = ref(false)

// ========================================
// Handlers
// ========================================

function handleOpenMembersPanel() {
  showMembersPanel.value = true
  open.value = false
}

function handleOpenInviteModal() {
  showInviteModal.value = true
  open.value = false
}

async function handleRequestToJoin() {
  if (!thisRoom.value) return
  actionLoading.value = true
  await requestToJoin(thisRoom.value.id)
  actionLoading.value = false
}

async function handleCancelRequest() {
  if (!thisRoom.value) return
  actionLoading.value = true
  await cancelJoinRequest(thisRoom.value.id)
  actionLoading.value = false
}

async function handleAcceptInvitation() {
  if (!pendingInvitationId.value) return
  actionLoading.value = true
  await acceptInvitation(pendingInvitationId.value)
  actionLoading.value = false
  open.value = false
}

async function handleDeclineInvitation() {
  if (!pendingInvitationId.value) return
  actionLoading.value = true
  await declineInvitation(pendingInvitationId.value)
  actionLoading.value = false
}

async function handleLeaveRoom() {
  actionLoading.value = true
  const success = await leaveRoomMembership()
  actionLoading.value = false
  if (success) {
    open.value = false
  }
}

// Fetch invitations and membership on mount
onMounted(async () => {
  await Promise.all([
    fetchReceivedInvitations(true),
    fetchMyMembership()
  ])
})
</script>

<template>
  <!-- Settings Drawer -->
  <UDrawer v-model:open="open" title="Room Settings" description="Manage room settings and members.">
    <template #content>
      <div class="px-3 mt-3 flex flex-col gap-3 pb-4">

        <!-- Admin Actions (Owner/Admin only) -->
        <template v-if="canManageMembers">
          <SectionTitle>Room Management</SectionTitle>

          <!-- Manage Members -->
          <UButton
            color="info"
            icon="i-lucide-users"
            trailing-icon="i-lucide-chevron-right"
            variant="subtle"
            size="xl"
            class="w-full justify-center"
            @click="handleOpenMembersPanel"
          >
            Manage Members
          </UButton>

          <!-- Invite User -->
          <UButton
            color="success"
            icon="i-lucide-user-plus"
            trailing-icon="i-lucide-chevron-right"
            variant="subtle"
            size="xl"
            class="w-full justify-center"
            @click="handleOpenInviteModal"
          >
            Invite User
          </UButton>
        </template>

        <!-- Non-Member Actions (for users not yet in the room) -->
        <template v-if="membershipState === 'none'">
          <SectionTitle>Join This Room</SectionTitle>
          <UButton
            color="info"
            icon="i-lucide-user-plus"
            trailing-icon="i-lucide-chevron-right"
            variant="subtle"
            size="xl"
            class="w-full justify-center"
            :loading="actionLoading"
            @click="handleRequestToJoin"
          >
            Request to Join
          </UButton>
        </template>

        <!-- Pending Request Actions -->
        <template v-else-if="membershipState == 'pending_request'">
          <SectionTitle>Join Request Pending</SectionTitle>
          <p class="text-sm text-muted text-center">Your request is awaiting approval.</p>
          <UButton
            icon="i-lucide-x"
            color="warning"
            variant="subtle"
            size="xl"
            class="w-full justify-center"
            :loading="actionLoading"
            @click="handleCancelRequest"
          >
            Cancel Request
          </UButton>
        </template>

        <!-- Has Invitation Actions -->
        <template v-else-if="membershipState === 'has_invitation'">
          <SectionTitle>You've Been Invited!</SectionTitle>
          <p class="text-sm text-muted text-center mb-2">The room owner has invited you to join.</p>
          <div class="flex gap-2">
            <UButton
              icon="i-lucide-check"
              color="success"
              variant="subtle"
              size="xl"
              class="w-full justify-center"
              :loading="actionLoading"
              @click="handleAcceptInvitation"
            >
              Accept
            </UButton>
            <UButton
              icon="i-lucide-x"
              color="error"
              variant="subtle"
              size="xl"
              class="w-full justify-center"
              :loading="actionLoading"
              @click="handleDeclineInvitation"
            >
              Decline
            </UButton>
          </div>
        </template>

        <!-- Member Actions (for regular members - show Leave Room) -->
        <template v-else-if="membershipState === 'member' || membershipState === 'admin'">
          <SectionTitle>Membership</SectionTitle>
          <UButton
            icon="i-lucide-log-out"
            color="error"
            variant="subtle"
            size="xl"
            class="w-full justify-center"
            :loading="actionLoading"
            @click="handleLeaveRoom"
          >
            Leave Room
          </UButton>
        </template>

        <!-- Close Button -->
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-x"
          class="justify-center mt-4"
          @click="open = false"
        >
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>

  <!-- Members Panel (separate drawer) -->
  <RoomMembersPanel v-model:open="showMembersPanel" :room-id="thisRoom?.id ?? 0" />

  <!-- Invite User Modal (separate modal) -->
  <RoomInviteUserModal v-model:open="showInviteModal" :room-id="thisRoom?.id ?? 0" />
</template>
