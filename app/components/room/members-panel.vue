<script setup lang="ts">
// ========================================
// Room Members Panel (Tabbed)
// ========================================
//
// Drawer with 3 tabs:
// - Members: List of room members
// - Requests: Pending join requests (with badge)
// - Blocked: Blocked users list

import MembersTab from "~/components/room/members/members-tab.vue";
import RequestsTab from "~/components/room/members/requests-tab.vue";
import BlockedTab from "~/components/room/members/blocked-tab.vue";

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

// ========================================
// Composables
// ========================================

const { pendingRequestCount } = useRoomJoinRequests();
const { blockedUsers, loading: blockedLoading, fetchBlockedUsers, unblockUser, blockUser } = useRoomBlocking();
const { kickMember, promoteMember, demoteMember } = useRoomMemberManagement({
  blockUser,
  fetchBlockedUsers,
});
const {
  actionLoading,
  pendingInvitationId: pendingInvitationIdFor,
  requestJoin,
  cancelRequest,
  acceptInvite,
  declineInvite,
  leaveRoom,
  loadPanelData,
} = useRoomMembershipActions();

/** Membership state + manage rights (shared derivation — see useRoomMembershipState) */
const { membershipState, canEdit: canManageMembers } = useRoomMembershipState(
  () => props.roomId
);

// ========================================
// Computed
// ========================================

const tabs = computed(() => [
  { label: "Members", value: "members", icon: "i-lucide-users" },
  {
    label: "Requests",
    value: "requests",
    icon: "i-lucide-user-plus",
    badge: pendingRequestCount.value > 0 ? pendingRequestCount.value : undefined,
  },
  { label: "Blocked", value: "blocked", icon: "i-lucide-ban" },
]);

const pendingInvitationId = pendingInvitationIdFor(() => props.roomId);

// ========================================
// Watchers
// ========================================

watch(
  [open, () => props.roomId],
  ([isOpen, roomId]) => {
    if (isOpen && roomId) loadPanelData(roomId, canManageMembers.value, fetchBlockedUsers);
  },
  { immediate: true },
);

// ========================================
// Handlers
// ========================================

async function handleRequestToJoin() {
  await requestJoin(props.roomId);
}

async function handleCancelRequest() {
  await cancelRequest(props.roomId);
}

async function handleAcceptInvitation() {
  if (!pendingInvitationId.value) return;
  const success = await acceptInvite(pendingInvitationId.value);
  if (success) open.value = false;
}

async function handleDeclineInvitation() {
  if (!pendingInvitationId.value) return;
  await declineInvite(pendingInvitationId.value);
}

async function handleLeaveRoom() {
  const success = await leaveRoom(props.roomId);
  if (success) open.value = false;
}

async function handleUnblock(userId: number) {
  await unblockUser(props.roomId, userId);
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
            @click="() => { activeTab = tab.value }"
          >
            {{ tab.label }}
            <UBadge v-if="tab.badge" color="error" class="ml-1 font-bold px-1 py-0">{{ tab.badge }}</UBadge>
          </UButton>
        </div>

        <MembersTab
          v-if="canManageMembers && activeTab === 'members'"
          :room-id="props.roomId"
          :open="open"
          :can-manage-members="canManageMembers"
          :kick-member="kickMember"
          :promote-member="promoteMember"
          :demote-member="demoteMember"
        />

        <RequestsTab v-if="canManageMembers && activeTab === 'requests'" />

        <BlockedTab
          v-if="canManageMembers && activeTab === 'blocked'"
          :blocked-users="blockedUsers"
          :loading="blockedLoading"
          @unblock="handleUnblock"
        />

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
          @click="() => { open = false }"
        >
          Close
        </UButton>
      </div>
    </template>
  </UDrawer>
</template>
