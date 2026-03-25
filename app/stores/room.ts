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
  // Computed
  // ========================================
  const isRoomOwner = computed(() => {
    if (!currentRoom.value) return false;
    const authStore = useAuthStore();
    return currentRoom.value.owner?.id === authStore.user?.id;
  });

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
   * Set current room. Caller passes current route for back-navigation.
   */
  function setCurrentRoom(room: Room | null, fromRoute?: string) {
    if (fromRoute) previousRoute.value = fromRoute;
    currentRoom.value = room;
    isMinimized.value = false;
  }

  /**
   * Refresh currentRoom data without resetting isMinimized or previousRoute.
   */
  function refreshCurrentRoom(room: Room) {
    currentRoom.value = room;
  }

  function setUserRoom(room: Room | null) {
    userRoom.value = room;
  }

  function leaveRoom() {
    currentRoom.value = null;
    isMinimized.value = false;

    // Clear audio & seats stores
    const audioStore = useRoomAudioStore();
    audioStore.clearAudioState();
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

    // Computed
    isRoomOwner,

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
