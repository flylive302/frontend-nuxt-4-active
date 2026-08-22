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
  // Core Room State — IN-MEMORY ONLY
  // ========================================
  // 🔴 This store must never get a `persist:` block. `currentRoom` mutates on
  // every gift (`room_xp`, `daily_xp`) and every participant-count update, and
  // Pinia's persistence watcher is `{ deep: true }` over the WHOLE store — so
  // any persisted key here makes every gift deep-walk, serialise and re-write
  // storage. The persisted half lives in `roomSessionStore`; cross-store
  // transitions go through `useRoomSession()`.
  // See docs/issues/android-client-performance/12-split-room-store-persistence.md
  const currentRoom = ref<Room | null>(null);
  const isMinimized = ref(false);
  const status = ref<StatusType>('idle');

  // ========================================
  // Actions
  // ========================================

  function updateStatus(newStatus: StatusType) {
    status.value = newStatus;
  }

  function setMinimized(value: boolean) {
    isMinimized.value = value;
  }

  /** Set the current room. Always un-minimizes. */
  function setCurrentRoom(room: Room | null) {
    currentRoom.value = room;
    isMinimized.value = false;
  }

  /**
   * Refresh currentRoom data without resetting isMinimized.
   * Merges into existing state so incomplete payloads (e.g. a response that
   * omits an optional nested relation) can't strip fields already in the store.
   */
  function refreshCurrentRoom(room: Partial<Room>) {
    if (!currentRoom.value) return;
    currentRoom.value = { ...currentRoom.value, ...room };
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

  return {
    // State
    currentRoom,
    isMinimized,
    status,

    // Actions
    updateStatus,
    setMinimized,
    setCurrentRoom,
    refreshCurrentRoom,
    bumpDailyXp,
    updateParticipantCount,
  };
});
