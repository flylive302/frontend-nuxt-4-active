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
    }
  }

  function maximizeRoom() {
    if (currentRoom.value) {
      isMinimized.value = false;
    }
  }

  /**
   * Set the current room. Caller passes the current route for back-navigation.
   */
  function setCurrentRoom(room: Room | null, fromRoute?: string) {
    if (fromRoute) previousRoute.value = fromRoute;
    currentRoom.value = room;
    isMinimized.value = false;
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
  }

  function updateRoomLevel(level: number, xp: string) {
    if (currentRoom.value) {
      currentRoom.value.current_level = level;
      currentRoom.value.room_xp = xp;
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
    previousRoute,
    status,

    // Actions
    updateStatus,
    minimizeRoom,
    maximizeRoom,
    setCurrentRoom,
    refreshCurrentRoom,
    setUserRoom,
    leaveRoom,
    updateRoomLevel,
    updateParticipantCount,
  };
}, {
  persist: {
    pick: ['userRoom', 'currentRoom', 'isMinimized', 'previousRoute'],
  },
});
