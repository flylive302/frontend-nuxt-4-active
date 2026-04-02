/**
 * Seat Actions Composable
 *
 * Handles all seat-related operations for room audio.
 * Extracted from useRoomAudio.ts for modularity.
 */
import type { SeatResponse } from '~/types/room/audio';
import { userToParticipant } from '~/types/room/audio';
import type { MinimalUser } from '~/types/user/bootstrap';

// ============================================
// Types
// ============================================

export interface UseSeatActionsParams {
  emitAsync: <TPayload, TResponse>(event: string, payload: TPayload) => Promise<TResponse>;
  getCurrentRoomId: () => string | null;
  audioStore: ReturnType<typeof useRoomAudioStore>;
  seatsStore: ReturnType<typeof useRoomSeatsStore>;
  authStore: ReturnType<typeof useAuthStore>;
  toast: ReturnType<typeof useToast>;
  stopAudio: () => void;
}

export interface UseSeatActionsReturn {
  /** Take an available seat */
  takeSeat: (seatIndex: number) => Promise<boolean>;
  /** Leave current seat */
  leaveSeat: () => Promise<boolean>;
  /** Owner: Assign user to seat */
  assignUserToSeat: (userId: number, seatIndex: number) => Promise<boolean>;
  /** Owner: Remove user from seat */
  removeUserFromSeat: (userId: number) => Promise<boolean>;
  /** Owner: Mute user */
  muteUser: (userId: number) => Promise<boolean>;
  /** Owner: Unmute user */
  unmuteUser: (userId: number) => Promise<boolean>;
  /** Owner: Lock a seat */
  lockSeat: (seatIndex: number) => Promise<boolean>;
  /** Owner: Unlock a seat */
  unlockSeat: (seatIndex: number) => Promise<boolean>;
  /** Owner: Invite user to a seat */
  inviteToSeat: (userId: number, seatIndex: number) => Promise<boolean>;
  /** Accept pending invite */
  acceptInvite: () => Promise<boolean>;
  /** Decline pending invite */
  declineInvite: () => Promise<boolean>;
  /** Admin/Owner: Kick user from room */
  kickUser: (userId: number) => Promise<boolean>;
}

// ============================================
// Composable
// ============================================

/**
 * Seat management actions for room audio.
 * Handles taking, leaving, assigning, and managing seats.
 */
export function useSeatActions({
  emitAsync,
  getCurrentRoomId,
  audioStore,
  seatsStore,
  authStore,
  toast,
  stopAudio,
}: UseSeatActionsParams): UseSeatActionsReturn {
  /**
   * Take an available seat.
   */
  async function takeSeat(seatIndex: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:take', {
      roomId,
      seatIndex,
    });

    if (response.error) {
      toast.add({ title: 'Cannot take seat', description: response.error, color: 'error' });
      return false;
    }

    // Update local seat state for the current user
    // (Socket.IO's socket.to() excludes sender, so we update locally)
    if (response.success && authStore.user) {
      // Ensure current user is in participants map for updateSeat lookup
      const currentUser = userToParticipant({
        ...authStore.user,
        email: null,
      } as MinimalUser, { isSpeaker: true, seatIndex });
      audioStore.addParticipant(currentUser);
      seatsStore.updateSeat(
        seatIndex,
        currentUser,
        false,
        audioStore.audioState.activeSpeakerIds,
      );
      currentUser.isSpeaker = true;
      currentUser.seatIndex = seatIndex;
    }

    return response.success ?? false;
  }

  /**
   * Leave current seat.
   */
  async function leaveSeat(): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    // Find current user's seat before leaving
    const currentUserSeatIndex = authStore.user
      ? seatsStore.seats.findIndex((s) => s.user?.id === authStore.user!.id)
      : -1;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:leave', {
      roomId,
    });

    if (response.error) {
      toast.add({ title: 'Cannot leave seat', description: response.error, color: 'error' });
      return false;
    }

    // Clear local seat state
    // (Socket.IO's socket.to() excludes sender, so we update locally)
    if (response.success && currentUserSeatIndex >= 0) {
      const uid = authStore.user?.id;
      seatsStore.clearSeat(currentUserSeatIndex);
      if (uid != null) {
        const p = audioStore.participants.get(uid);
        if (p) {
          p.isSpeaker = false;
          p.seatIndex = undefined;
        }
      }
    }

    stopAudio();
    return response.success ?? false;
  }

  /**
   * Owner: Assign a user to a seat.
   */
  async function assignUserToSeat(userId: number, seatIndex: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; userId: number; seatIndex: number }, SeatResponse>(
      'seat:assign',
      { roomId, userId, seatIndex }
    );

    if (response.error) {
      toast.add({ title: 'Cannot assign seat', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Owner: Remove a user from their seat.
   */
  async function removeUserFromSeat(userId: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:remove', {
      roomId,
      userId,
    });

    if (response.error) {
      toast.add({ title: 'Cannot remove user', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Owner: Mute a user.
   */
  async function muteUser(userId: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:mute', {
      roomId,
      userId,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Unmute a user.
   */
  async function unmuteUser(userId: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('seat:unmute', {
      roomId,
      userId,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Lock a seat.
   */
  async function lockSeat(seatIndex: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:lock', {
      roomId,
      seatIndex,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Unlock a seat.
   */
  async function unlockSeat(seatIndex: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; seatIndex: number }, SeatResponse>('seat:unlock', {
      roomId,
      seatIndex,
    });

    return response.success ?? false;
  }

  /**
   * Owner: Invite user to a seat.
   */
  async function inviteToSeat(userId: number, seatIndex: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; userId: number; seatIndex: number }, SeatResponse>(
      'seat:invite',
      { roomId, userId, seatIndex }
    );

    if (response.error) {
      toast.add({ title: 'Cannot invite', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Accept pending invite.
   */
  async function acceptInvite(): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:invite:accept', {
      roomId,
    });

    if (response.error) {
      toast.add({ title: 'Cannot accept invite', description: response.error, color: 'error' });
      return false;
    }

    return response.success ?? false;
  }

  /**
   * Decline pending invite.
   */
  async function declineInvite(): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string }, SeatResponse>('seat:invite:decline', {
      roomId,
    });

    return response.success ?? false;
  }

  /**
   * Kick user from the room (admin/owner only).
   * Emits room:kick — server handles seat clearing, socket removal, and broadcasting.
   */
  async function kickUser(userId: number): Promise<boolean> {
    const roomId = getCurrentRoomId();
    if (!roomId) return false;

    const response = await emitAsync<{ roomId: string; userId: number }, SeatResponse>('room:kick', {
      roomId,
      userId,
    });

    if (response.error) {
      toast.add({ title: 'Cannot kick user', description: response.error, color: 'error' });
      return false;
    }

    if (response.success) {
      toast.add({ title: 'User kicked', description: 'User has been removed from the room.', color: 'success' });
    }

    return response.success ?? false;
  }

  return {
    takeSeat,
    leaveSeat,
    assignUserToSeat,
    removeUserFromSeat,
    muteUser,
    unmuteUser,
    lockSeat,
    unlockSeat,
    inviteToSeat,
    acceptInvite,
    declineInvite,
    kickUser,
  };
}
