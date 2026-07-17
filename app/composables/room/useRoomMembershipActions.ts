// ========================================
// Room Membership Actions (Action composable)
// ========================================
//
// Non-manager membership actions (request/cancel/accept/decline/leave) plus
// the members-panel fetch orchestration. GATE -> EXECUTE -> REACT per action.
// Accept/leave return success; callers (e.g. the panel) decide UI reactions
// such as closing a drawer.

import type { MaybeRefOrGetter } from "vue";

export function useRoomMembershipActions() {
  const { fetchMembers } = useRoomMembers();
  const {
    fetchJoinRequests,
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

  // ========================================
  // State
  // ========================================

  const actionLoading = ref(false);

  // ========================================
  // Helpers
  // ========================================

  /**
   * Pending invitation for the current user in the given room, if any.
   */
  function pendingInvitationId(roomId: MaybeRefOrGetter<number | null | undefined>) {
    return computed(() => {
      const id = toValue(roomId);
      const pendingInvite = receivedInvitations.value.items.find(
        (inv) => inv && (inv.room_id === id || inv.room?.id === id) && inv.status === "pending",
      );
      return pendingInvite?.id;
    });
  }

  // ========================================
  // Actions
  // ========================================

  async function requestJoin(roomId: number): Promise<void> {
    actionLoading.value = true;
    await requestToJoin(roomId);
    actionLoading.value = false;
  }

  async function cancelRequest(roomId: number): Promise<void> {
    actionLoading.value = true;
    await cancelJoinRequest(roomId);
    actionLoading.value = false;
  }

  async function acceptInvite(invitationId: number): Promise<boolean> {
    actionLoading.value = true;
    const success = await acceptInvitation(invitationId);
    actionLoading.value = false;
    return success;
  }

  async function declineInvite(invitationId: number): Promise<void> {
    actionLoading.value = true;
    await declineInvitation(invitationId);
    actionLoading.value = false;
  }

  async function leaveRoom(roomId: number): Promise<boolean> {
    actionLoading.value = true;
    const success = await leaveRoomMembership(roomId);
    actionLoading.value = false;
    return success;
  }

  /**
   * Fetch orchestration for the members panel. Managers load the members /
   * requests / blocked lists; non-managers load their own membership state.
   *
   * fetchBlockedUsers is injected: useRoomBlocking()'s blockedUsers list is a
   * plain local ref (not store-backed), so the caller must pass in the same
   * instance it renders from — calling useRoomBlocking() here would create
   * an independent, invisible copy.
   */
  async function loadPanelData(
    roomId: number,
    canManageMembers: boolean,
    fetchBlockedUsers: (roomId: number) => Promise<void>,
  ): Promise<void> {
    if (canManageMembers) {
      await Promise.all([
        fetchMembers(roomId, {}, true),
        fetchJoinRequests(roomId, true),
        fetchBlockedUsers(roomId),
      ]);
    } else {
      await Promise.all([
        fetchMyMembership(),
        fetchMyJoinRequests(),
        fetchReceivedInvitations(true),
      ]);
    }
  }

  return {
    // State
    actionLoading,

    // Helpers
    pendingInvitationId,

    // Actions
    requestJoin,
    cancelRequest,
    acceptInvite,
    declineInvite,
    leaveRoom,
    loadPanelData,
  };
}
