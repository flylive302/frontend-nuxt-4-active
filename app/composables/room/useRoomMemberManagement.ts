// ========================================
// Room Member Management (Action composable)
// ========================================
//
// Owner/admin actions on room members: kick (= block with duration, ADR
// 0017), promote, demote. Each action is optimistic — mutate the members
// store immediately, revert on failure. GATE -> EXECUTE -> REACT per action.
//
// blockUser/fetchBlockedUsers come from useRoomBlocking(), whose blockedUsers
// list is a plain local ref (not store-backed) — every useRoomBlocking()
// call creates an independent instance. To keep the kick REACT (refresh the
// blocked list) visible to whichever component displays it, the caller must
// pass in the SAME useRoomBlocking() instance it uses for display.

import type { RoomMember, BlockUserRequest } from "~/types/room/room";
import type { BlockDurationValue } from "~/constants/room";

export interface RoomMemberManagementDeps {
  blockUser: (roomId: number, request: BlockUserRequest) => Promise<boolean>;
  fetchBlockedUsers: (roomId: number) => Promise<void>;
}

export function useRoomMemberManagement(deps: RoomMemberManagementDeps) {
  const { blockUser, fetchBlockedUsers } = deps;
  const { updateMemberRole } = useRoomMemberActions();

  /**
   * Kick (= block with a duration) a member from the room. Unified kick path
   * (ADR 0017): there is no duration-less kick, so every call must carry one
   * of the six canonical BlockDuration values selected from the duration
   * popover anchored above the kick action.
   */
  async function kickMember(
    roomId: number,
    member: RoomMember,
    duration: BlockDurationValue,
  ): Promise<void> {
    // GATE
    const userId = member.user_id ?? member.user?.id;
    if (!userId) return;

    // EXECUTE (optimistic remove + revert on failure)
    const membershipStore = useRoomMembershipStore();
    const originalMembers = [...membershipStore.members.items];
    membershipStore.members.items = membershipStore.members.items.filter(
      (m) => m.user_id !== userId,
    );

    const success = await blockUser(roomId, { user_id: userId, duration });
    if (!success) {
      membershipStore.members.items = originalMembers;
      return;
    }

    // REACT
    fetchBlockedUsers(roomId);
  }

  /**
   * Promote a member to admin (optimistic role update + revert on failure).
   */
  async function promoteMember(roomId: number, member: RoomMember): Promise<void> {
    // GATE
    const userId = member.user_id ?? member.user?.id;
    if (!userId) return;

    // EXECUTE (optimistic + revert on failure)
    const membershipStore = useRoomMembershipStore();
    const memberItem = membershipStore.members.items.find((m) => m.user_id === userId);
    const originalRole = memberItem?.role;
    if (memberItem) memberItem.role = "admin";

    const success = await updateMemberRole(roomId, userId, { role: "admin" });
    if (!success && memberItem && originalRole) {
      memberItem.role = originalRole;
    }
  }

  /**
   * Demote a member to plain member (optimistic role update + revert on failure).
   */
  async function demoteMember(roomId: number, member: RoomMember): Promise<void> {
    // GATE
    const userId = member.user_id ?? member.user?.id;
    if (!userId) return;

    // EXECUTE (optimistic + revert on failure)
    const membershipStore = useRoomMembershipStore();
    const memberItem = membershipStore.members.items.find((m) => m.user_id === userId);
    const originalRole = memberItem?.role;
    if (memberItem) memberItem.role = "member";

    const success = await updateMemberRole(roomId, userId, { role: "member" });
    if (!success && memberItem && originalRole) {
      memberItem.role = originalRole;
    }
  }

  return {
    kickMember,
    promoteMember,
    demoteMember,
  };
}
