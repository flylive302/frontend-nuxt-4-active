import { defineStore } from 'pinia';
import type { BootstrapRoom as Room } from '~/types/user/bootstrap';

// ============================================
// Types
// ============================================
type StatusType = 'idle' | 'loading' | 'error';

// ============================================
// Store
// ============================================
export const useRoomStore = defineStore('roomStore', () => {
  // ========================================
  // Core Room State
  // ========================================
  const currentRoom = ref<Room | null>(null);
  const userRoom = ref<Room | null>(null);
  const isMinimized = ref(false);
  const previousRoute = ref('/');
  const status = ref<StatusType>('idle');

  /**
   * Persisted snapshot of a minimized room. Distinct from `currentRoom`
   * (in-memory only) on purpose: it survives a cold start so the mini-player
   * can offer a "tap to rejoin" affordance, WITHOUT the immediate lifecycle
   * watcher auto-joining on boot. Restore is always an explicit user tap.
   * Set on minimize; cleared on maximize / leave / entering a new room.
   */
  const minimizedRoom = ref<Room | null>(null);

  /**
   * Persisted marker for the room the user is *actively* in, with the timestamp
   * of its last heartbeat. Distinct from `minimizedRoom`, which is cleared by
   * `setCurrentRoom` and so is always null for an active session — precisely the
   * case a reload has to recover.
   *
   * Only a marker whose heartbeat is within ACTIVE_ROOM_MARKER_TTL_MS may
   * authorise an automatic rehydrate. The TTL is what keeps this from becoming a
   * "shared links auto-join you" mechanism: a stale marker is ignored, so a cold
   * link tap behaves exactly as it does today.
   */
  const activeRoom = ref<{ id: number; at: number } | null>(null);

  // ========================================
  // Actions
  // ========================================

  function updateStatus(newStatus: StatusType) {
    status.value = newStatus;
  }

  /**
   * Minimize room — sets flag only.
   * The caller (composable) handles navigateTo().
   */
  function minimizeRoom() {
    if (currentRoom.value) {
      isMinimized.value = true;
      minimizedRoom.value = currentRoom.value;
    }
  }

  function maximizeRoom() {
    if (currentRoom.value) {
      isMinimized.value = false;
      minimizedRoom.value = null;
    }
  }

  /**
   * Set the current room. Caller passes the current route for back-navigation.
   */
  function setCurrentRoom(room: Room | null, fromRoute?: string) {
    if (fromRoute) previousRoute.value = fromRoute;
    currentRoom.value = room;
    isMinimized.value = false;
    minimizedRoom.value = null;
    activeRoom.value = room ? { id: room.id, at: Date.now() } : null;
  }

  /**
   * Refresh the active-room marker's heartbeat. Called on an interval by the
   * room lifecycle so the marker stays inside its TTL for as long as the user is
   * genuinely in the room, and goes stale on its own once they are not.
   */
  function touchActiveRoom() {
    if (currentRoom.value) {
      activeRoom.value = { id: currentRoom.value.id, at: Date.now() };
    }
  }

  function clearActiveRoom() {
    activeRoom.value = null;
  }

  /**
   * Refresh currentRoom data without resetting isMinimized or previousRoute.
   * Merges into existing state so incomplete payloads (e.g. a response that
   * omits an optional nested relation) can't strip fields already in the store.
   */
  function refreshCurrentRoom(room: Partial<Room>) {
    if (!currentRoom.value) return;
    currentRoom.value = { ...currentRoom.value, ...room };
  }

  function setUserRoom(room: Room | null) {
    userRoom.value = room;
  }

  /**
   * Clear local room session state. Audio/mediasoup teardown is handled by
   * useRoomLifecycle watching currentRoom or by useRoomAudio.leaveRoom().
   */
  function leaveRoom() {
    currentRoom.value = null;
    isMinimized.value = false;
    minimizedRoom.value = null;
    // A genuine leave must invalidate the marker immediately — otherwise a
    // reload moments later would rehydrate a room the user deliberately left.
    activeRoom.value = null;
  }

  /**
   * Optimistic bump of live daily XP (mirrors the room_xp bump technique used
   * by useRoomGifts.sendGift / useRoomEventHandlers's gift:received handler).
   * Corrects on next authoritative sync (rejoin/refetch/drawer refresh) —
   * no local midnight-rollover handling needed here.
   */
  function bumpDailyXp(amount: number) {
    if (currentRoom.value) {
      const currentXp = parseFloat(currentRoom.value.daily_xp || '0');
      currentRoom.value.daily_xp = (currentXp + amount).toString();
    }
  }

  function updateParticipantCount(count: number) {
    if (currentRoom.value) {
      currentRoom.value.participant_count = count;
    }
  }

  // ========================================
  // Return
  // ========================================
  return {
    // State
    currentRoom,
    userRoom,
    isMinimized,
    minimizedRoom,
    activeRoom,
    previousRoute,
    status,

    // Actions
    updateStatus,
    minimizeRoom,
    maximizeRoom,
    setCurrentRoom,
    touchActiveRoom,
    clearActiveRoom,
    refreshCurrentRoom,
    setUserRoom,
    leaveRoom,
    bumpDailyXp,
    updateParticipantCount,
  };
}, {
  persist: {
    pick: ['userRoom', 'previousRoute', 'minimizedRoom', 'activeRoom'],
  },
});
