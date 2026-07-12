<script setup lang="ts">
// ========================================
// Room Members Panel (Tabbed)
// ========================================
//
// Drawer with 3 tabs:
// - Members: List of room members
// - Requests: Pending join requests (with badge)
// - Blocked: Blocked users list

import type { RoomMember, RoomJoinRequest } from "~/types/room/room";
import type { BlockDurationValue } from "~/constants/room";
import KickDurationPopover from "~/components/room/kick-duration-popover.vue";


// ========================================
// Props
// ========================================

const props = defineProps<{
  roomId: number;
}>();

// ========================================
// State
// ========================================

const open = defineModel<boolean>("open", { default: false });
const activeTab = ref("members");

const showInviteModal = ref(false);

// ========================================
// Composables
// ========================================

const { members, loading: membersLoading, fetchMembers } = useRoomMembers();
const {
  joinRequests,
  pendingRequestCount,
  fetchJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  requestToJoin,
  cancelJoinRequest,
  fetchMyJoinRequests,
} = useRoomJoinRequests();
const {
  acceptInvitation,
  declineInvitation,
  receivedInvitations,
  fetchReceivedInvitations,
} = useRoomInvitations();
const { fetchMyMembership, leaveRoomMembership } = useRoomMembers();
const {
  blockedUsers,
  loading: blockedLoading,
  fetchBlockedUsers,
  unblockUser,
  blockUser,
} = useRoomBlocking();
const { updateMemberRole } = useRoomMemberActions();

// ========================================
// Computed
// ========================================

const tabs = computed(() => [
  {
    label: "Members",
    value: "members",
    icon: "i-lucide-users",
  },
  {
    label: "Requests",
    value: "requests",
    icon: "i-lucide-user-plus",
    badge:
      pendingRequestCount.value > 0 ? pendingRequestCount.value : undefined,
  },
  {
    label: "Blocked",
    value: "blocked",
    icon: "i-lucide-ban",
  },
]);

/** Membership state + manage rights (shared derivation — see useRoomMembershipState) */
const { membershipState, canEdit: canManageMembers } = useRoomMembershipState(
  () => props.roomId
);

const pendingInvitationId = computed(() => {
  const roomId = props.roomId;
  const pendingInvite = receivedInvitations.value.items.find(
    (inv) => inv && (inv.room_id === roomId || inv.room?.id === roomId) && inv.status === 'pending'
  );
  return pendingInvite?.id;
});

const actionLoading = ref(false);

async function handleRequestToJoin() {
  actionLoading.value = true;
  await requestToJoin(props.roomId);
  actionLoading.value = false;
}

async function handleCancelRequest() {
  actionLoading.value = true;
  await cancelJoinRequest(props.roomId);
  actionLoading.value = false;
}

async function handleAcceptInvitation() {
  if (!pendingInvitationId.value) return;
  actionLoading.value = true;
  await acceptInvitation(pendingInvitationId.value);
  actionLoading.value = false;
  open.value = false;
}

async function handleDeclineInvitation() {
  if (!pendingInvitationId.value) return;
  actionLoading.value = true;
  await declineInvitation(pendingInvitationId.value);
  actionLoading.value = false;
}

async function handleLeaveRoom() {
  actionLoading.value = true;
  const success = await leaveRoomMembership(props.roomId);
  actionLoading.value = false;
  if (success) open.value = false;
}

// ========================================
// Watchers
// ========================================

watch(
  [open, () => props.roomId],
  ([isOpen, roomId]) => {
    if (isOpen && roomId) {
      // Fetch data when drawer opens
      if (canManageMembers.value) {
        fetchMembers(roomId, {}, true);
        fetchJoinRequests(roomId, true);
        fetchBlockedUsers(roomId);
      } else {
        // Non-managers: fetch state needed for the membership action block
        fetchMyMembership();
        fetchMyJoinRequests();
        fetchReceivedInvitations(true);
      }
    }
  },
  { immediate: true },
);

// ========================================
// Handlers
// ========================================

async function handleApprove(request: RoomJoinRequest) {
  await approveJoinRequest(request.id);
}

async function handleReject(request: RoomJoinRequest) {
  await rejectJoinRequest(request.id);
}

async function handleUnblock(userId: number) {
  await unblockUser(props.roomId, userId);
}

// Admin actions with optimistic updates
/**
 * Kick (= block with a duration) a member from the room. Unified kick path
 * (ADR 0017): there is no duration-less kick, so every call must carry one
 * of the six canonical BlockDuration values selected from the duration
 * popover anchored above the kick action.
 */
async function handleKickMember(member: RoomMember, duration: BlockDurationValue) {
  const userId = member.user_id ?? member.user?.id;

  if (!userId) return;

  // Optimistic: remove from list immediately
  const membershipStore = useRoomMembershipStore();
  const originalMembers = [...membershipStore.members.items];
  membershipStore.members.items = membershipStore.members.items.filter(m => m.user_id !== userId);

  const success = await blockUser(props.roomId, { user_id: userId, duration });
  if (!success) {
    // Revert on error
    membershipStore.members.items = originalMembers;
  } else {
    fetchBlockedUsers(props.roomId);
  }
}

async function handlePromoteMember(member: RoomMember) {
  const userId = member.user_id ?? member.user?.id;

  if (!userId) return;

  // Optimistic: update role immediately
  const membershipStore = useRoomMembershipStore();
  const memberItem = membershipStore.members.items.find(m => m.user_id === userId);
  const originalRole = memberItem?.role;
  if (memberItem) {
    memberItem.role = 'admin';
  }

  const success = await updateMemberRole(props.roomId, userId, { role: "admin" });
  if (!success && memberItem && originalRole) {
    // Revert on error
    memberItem.role = originalRole;
  }
}

async function handleDemoteMember(member: RoomMember) {
  const userId = member.user_id ?? member.user?.id;

  if (!userId) return;

  // Optimistic: update role immediately
  const membershipStore = useRoomMembershipStore();
  const memberItem = membershipStore.members.items.find(m => m.user_id === userId);
  const originalRole = memberItem?.role;
  if (memberItem) {
    memberItem.role = 'member';
  }

  const success = await updateMemberRole(props.roomId, userId, { role: "member" });
  if (!success && memberItem && originalRole) {
    // Revert on error
    memberItem.role = originalRole;
  }
}

/**
 * Generate dropdown menu items for a member. Kick/block is handled by the
 * separate KickDurationPopover trigger (unified kick path, ADR 0017) — not a
 * dropdown item, since it requires a duration choice, not a single select.
 */
function getMemberActions(member: RoomMember) {
  return [
    [
      member.role === "admin"
        ? {
            label: "Demote to Member",
            icon: "i-lucide-arrow-down",
            onSelect: () => handleDemoteMember(member),
          }
        : {
            label: "Promote to Admin",
            icon: "i-lucide-arrow-up",
            onSelect: () => handlePromoteMember(member),
          },
    ],
  ];
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Room Members"
    description="Manage members, requests, and blocked users."
  >
    <template #content>
      <div class="px-3 mt-3 pb-4">
        <!-- Tabs (owner/admin only) -->
        <div v-if="canManageMembers" class="flex gap-2 mb-4">
          <UButton
            v-for="tab in tabs"
            :key="tab.value"
            :color="activeTab === tab.value ? 'primary' : 'neutral'"
            :variant="activeTab === tab.value ? 'solid' : 'soft'"
            :icon="tab.icon"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
            <UBadge v-if="tab.badge" color="error" class="ml-1 font-bold px-1 py-0">{{ tab.badge }}</UBadge>
          </UButton>
        </div>

        <!-- Members Tab -->
        <div v-if="canManageMembers && activeTab === 'members'" class="space-y-2">
          <!-- Invite User Button (owner/admin only) -->
          <UButton
            v-if="canManageMembers"
            icon="i-lucide-user-plus"
            color="primary"
            variant="soft"
            class="w-full justify-center mb-2"
            @click="showInviteModal = true"
          >
            Invite User
          </UButton>
          <RoomInviteUserModal v-model:open="showInviteModal" :room-id="props.roomId" />
          <div v-if="membersLoading" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
          </div>
          <div
            v-else-if="members.items.length === 0"
            class="text-center py-8 text-muted"
          >
            No members yet
          </div>
          <div
            v-for="member in members.items"
            v-else
            :key="member.id"
            class="flex items-center gap-3 p-2 rounded-lg bg-elevated/30 hover:bg-elevated/50 transition"
          >
            <LazyUserAvatar :img="member.user?.avatar" class="size-10" />
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ member.user?.name }}</p>
              <p class="text-xs text-muted">{{ member.role }}</p>
            </div>
            <UBadge
              v-if="member.role === 'owner'"
              color="warning"
              size="xs"
              icon="i-lucide-crown"
            >
              Owner
            </UBadge>
            <UBadge
              v-else-if="member.role === 'admin'"
              color="info"
              size="xs"
              icon="i-lucide-shield"
            >
              Admin
            </UBadge>

            <!-- Kick — unified kick path (ADR 0017): duration popup, no duration-less kick -->
            <KickDurationPopover
              v-if="canManageMembers && member.role !== 'owner'"
              @select="(duration: BlockDurationValue) => handleKickMember(member, duration)"
            >
              <UButton
                icon="i-lucide-log-out"
                color="error"
                variant="ghost"
                size="xs"
                @click.stop
              />
            </KickDurationPopover>

            <!-- Admin Actions Dropdown (not for owner, only if current user can manage) -->
            <UDropdownMenu
              v-if="canManageMembers && member.role !== 'owner'"
              :items="getMemberActions(member)"
              style="--ui-primary: var(--room-theme, var(--color-primary)); --ui-color-primary-500: var(--room-theme, var(--color-primary-500));"
            >
              <UButton
                icon="i-lucide-more-vertical"
                color="neutral"
                variant="ghost"
                size="xs"
                @click.stop
              />
            </UDropdownMenu>
          </div>
        </div>

        <!-- Requests Tab -->
        <div v-if="canManageMembers && activeTab === 'requests'" class="space-y-3">
          <div v-if="joinRequests.loading" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
          </div>
          <div
            v-else-if="joinRequests.items.length === 0"
            class="text-center py-8 text-muted"
          >
            No pending requests
          </div>
          <div
            v-for="request in joinRequests.items"
            v-else
            :key="request.id"
            class="bg-linear-to-bl to-neutral-950 rounded-lg border border-primary/30 overflow-hidden"
          >
            <!-- User Info -->
            <MinimalUserList :user="request.user">
              <template #actions>
                <!-- Request Message -->
                <div v-if="request.message" class="p-2 bg-muted/20">
                  <p class="text-sm italic">"{{ request.message }}"</p>
                </div>

                <!-- Actions -->
                <div class="flex">
                  <UButton
                      color="success"
                      variant="soft"
                      class="flex-1 justify-center rounded-none"
                      @click="handleApprove(request)"
                  >
                    Approve
                  </UButton>
                  <UButton
                      variant="soft"
                      color="error"
                      class="flex-1 justify-center rounded-none"
                      @click="handleReject(request)"
                  >
                    Reject
                  </UButton>
                </div>
              </template>
            </MinimalUserList>
          </div>
        </div>

        <!-- Blocked Tab -->
        <div v-if="canManageMembers && activeTab === 'blocked'" class="space-y-2">
          <div v-if="blockedLoading" class="flex justify-center py-8">
            <UIcon name="i-lucide-loader-2" class="animate-spin size-8" />
          </div>
          <div
            v-else-if="blockedUsers.length === 0"
            class="text-center py-8 text-muted"
          >
            No blocked users
          </div>
          <div
            v-for="block in blockedUsers"
            v-else
            :key="block.id"
            class="flex items-center gap-3 p-2 rounded-lg bg-elevated/30"
          >
            <LazyUserAvatar :img="block.user?.avatar" class="size-10" />
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ block.user?.name }}</p>
              <p class="text-xs text-muted">
                {{
                  block.is_permanent
                    ? "Permanent"
                    : `Until ${new Date(block.banned_until!).toLocaleDateString()}`
                }}
              </p>
            </div>
            <UButton
              icon="i-lucide-unlock"
              color="success"
              variant="ghost"
              size="sm"
              @click="handleUnblock(block.user.id)"
            >
              Unblock
            </UButton>
          </div>
        </div>

        <!-- Membership Actions (non-manager users) -->
        <template v-if="!canManageMembers">
          <template v-if="membershipState === 'none'">
            <UButton color="info" icon="i-lucide-user-plus" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleRequestToJoin">
              Request to Join
            </UButton>
          </template>

          <template v-else-if="membershipState === 'pending_request'">
            <p class="text-sm text-muted text-center mb-2">Your request is awaiting approval.</p>
            <UButton icon="i-lucide-x" color="warning" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleCancelRequest">
              Cancel Request
            </UButton>
          </template>

          <template v-else-if="membershipState === 'has_invitation'">
            <p class="text-sm text-muted text-center mb-2">The room owner has invited you to join.</p>
            <div class="flex gap-2">
              <UButton icon="i-lucide-check" color="success" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleAcceptInvitation">
                Accept
              </UButton>
              <UButton icon="i-lucide-x" color="error" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleDeclineInvitation">
                Decline
              </UButton>
            </div>
          </template>

          <template v-else-if="membershipState === 'member'">
            <UButton icon="i-lucide-log-out" color="error" variant="subtle" size="xl" class="w-full justify-center" :loading="actionLoading" @click="handleLeaveRoom">
              Leave Room
            </UButton>
          </template>
        </template>

        <!-- Close Button -->
        <UButton
          color="neutral"
          variant="subtle"
          icon="i-lucide-x"
          class="justify-center mt-4 w-full"
          @click="open = false"
        >
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
