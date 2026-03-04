import { defineStore } from 'pinia';
import type { BootstrapRoom as Room } from '~/types/user/bootstrap';
import type {
  RoomParticipant,
  ChatMessageEvent,
  AudioState,
  Seat,
} from '~/types/room/audio';
import { SEAT_COUNT, MAX_CHAT_MESSAGES } from '~/constants/room';
import { createLogger } from '~/utils/logger';

const storeLog = createLogger('[RoomStore]');

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
  const userRoom = ref<Room | null>(null); // Room owned by authenticated user
  const isMinimized = ref(false);
  const previousRoute = ref('/');  // Route to navigate back to on minimize
  const status = ref<StatusType>('idle');

  // ========================================
  // Audio State
  // ========================================
  const audioState = ref<AudioState>({
    isConnected: false,
    isProducing: false,
    isMuted: false,
    activeSpeakerIds: [],
  });

  // ========================================
  // Participants
  // ========================================
  const participants = ref<Map<number, RoomParticipant>>(new Map());

  // ========================================
  // Seats (15 speaker seats)
  // ========================================
  const seats = ref<Seat[]>(
    Array.from({ length: SEAT_COUNT }, (_, i) => ({
      index: i,
      user: null,
      isMuted: false,
      isActive: false,
      isLocked: false,
    }))
  );

  // ========================================
  // Chat Messages (Ephemeral)
  // ========================================
  const messages = ref<ChatMessageEvent[]>([]);

  // ========================================
  // Legacy Seat UI State
  // ========================================
  const activeSeat = ref<number | null>(null);
  const inviteModeSeat = ref<number | null>(null); // Index of seat being invited to

  function startInviteMode(seatIndex: number) {
    inviteModeSeat.value = seatIndex;
    activeSeat.value = null; // Clear active selection to close seat drawer
  }

  function cancelInviteMode() {
    inviteModeSeat.value = null;
  }

  // ========================================
  // Computed
  // ========================================
  const participantList = computed(() => Array.from(participants.value.values()));
  const speakersCount = computed(() => seats.value.filter((s) => s.user !== null).length);
  const isRoomOwner = computed(() => {
    if (!currentRoom.value) return false;
    const authStore = useAuthStore();
    // Check if current user is the room owner (room.owner is the owner)
    return currentRoom.value.owner?.id === authStore.user?.id;
  });

  // ========================================
  // Core Room Actions
  // ========================================
  function updateStatus(newStatus: StatusType) {
    status.value = newStatus;
  }

  function minimizeRoom() {
    if (currentRoom.value) {
      isMinimized.value = true;
      navigateTo(previousRoute.value, { replace: true });
    }
  }

  function maximizeRoom() {
    if (currentRoom.value) {
      isMinimized.value = false;
    }
  }

  function setCurrentRoom(room: Room | null) {
    // Save current route so minimizeRoom can navigate back
    const route = useRoute();
    previousRoute.value = route.fullPath;
    currentRoom.value = room;
    isMinimized.value = false;
  }

  function setUserRoom(room: Room | null) {
    userRoom.value = room;
  }

  function leaveRoom() {
    currentRoom.value = null;
    isMinimized.value = false;
    clearAudioState();
  }

  /**
   * Update room level from realtime event.
   * @param level - New level
   * @param xp - Current XP
   */
  function updateRoomLevel(level: number, xp: string) {
    if (currentRoom.value) {
      currentRoom.value.current_level = level;
      currentRoom.value.room_xp = xp;
    }
  }

  /**
   * Update participant count from realtime event.
   * @param count - New participant count
   */
  function updateParticipantCount(count: number) {
    if (currentRoom.value) {
      currentRoom.value.participant_count = count;
    }
  }

  // ========================================
  // Audio State Actions
  // ========================================
  /**
   * Set audio connection status.
   * @param connected - Whether audio is connected
   */
  function setAudioConnected(connected: boolean) {
    audioState.value.isConnected = connected;
  }

  function setProducing(producing: boolean) {
    audioState.value.isProducing = producing;
  }

  function setMuted(muted: boolean) {
    audioState.value.isMuted = muted;
  }

  /**
   * Set which speakers are currently active (top 3).
   * @param userIds - Array of active speaker user IDs
   */
  function setActiveSpeakers(userIds: number[]) {
    audioState.value.activeSpeakerIds = userIds;

    // Only mutate seats whose active state actually changed
    seats.value.forEach((seat) => {
      const shouldBeActive = seat.user != null && userIds.includes(seat.user.id);
      if (seat.isActive !== shouldBeActive) {
        seat.isActive = shouldBeActive;
      }
    });
  }

  function clearAudioState() {
    audioState.value = {
      isConnected: false,
      isProducing: false,
      isMuted: false,
      activeSpeakerIds: [],
    };
    participants.value.clear();
    messages.value = [];
    seats.value = Array.from({ length: SEAT_COUNT }, (_, i) => ({
      index: i,
      user: null,
      isMuted: false,
      isActive: false,
      isLocked: false,
    }));
  }

  // ========================================
  // Participant Actions
  // ========================================
  /**
   * Add a participant to the room.
   * @param user - Participant to add
   */
  function addParticipant(user: RoomParticipant) {
    participants.value.set(user.id, user);
  }

  function removeParticipant(userId: number) {
    participants.value.delete(userId);

    // Clear from seat if present
    const seat = seats.value.find((s) => s.user?.id === userId);
    if (seat) {
      seat.user = null;
      seat.isMuted = false;
      seat.isActive = false;
    }
  }

  /**
   * Update a participant's profile data in-place.
   * Called when MSAB broadcasts `user:profile_updated` after a backend profile change.
   * Also refreshes the user's seat snapshot so seated users show fresh data.
   *
   * @param userId - User whose profile changed
   * @param profile - Partial profile fields to merge (name, avatar, frame, etc.)
   */
  function updateParticipantProfile(userId: number, profile: Partial<RoomParticipant>) {
    const participant = participants.value.get(userId);
    if (!participant) return;

    // Merge profile fields into existing participant (preserve room-specific fields)
    Object.assign(participant, profile);

    // Refresh seat snapshot if user is seated
    const seat = seats.value.find((s) => s.user?.id === userId);
    if (seat && seat.user) {
      seat.user = { ...participant };
    }

    // Refresh room owner snapshot so header avatar stays current
    if (currentRoom.value?.owner?.id === userId) {
      currentRoom.value = {
        ...currentRoom.value,
        owner: { ...currentRoom.value.owner, ...profile },
      };
    }
  }

  function setParticipantMuted(userId: number, isMuted: boolean) {
    const participant = participants.value.get(userId);
    if (participant) {
      participant.isMuted = isMuted;
    }

    // Update seat if user is seated
    const seat = seats.value.find((s) => s.user?.id === userId);
    if (seat) {
      seat.isMuted = isMuted;
    }
  }

  // ========================================
  // Seat Actions
  // ========================================
  /**
   * Update a seat with user and mute state.
   * Looks up the user from the participants store by userId.
   * @param seatIndex - Zero-based seat index (0-14)
   * @param userId - User ID to assign, or null to clear
   * @param isMuted - Whether user is server-muted
   */
  function updateSeat(seatIndex: number, userId: number | null, isMuted: boolean) {
    if (seatIndex >= 0 && seatIndex < seats.value.length) {
      const user = userId !== null ? participants.value.get(userId) ?? null : null;

      storeLog.debug('updateSeat:', { seatIndex, userId, userName: user?.name });

      const currentSeat = seats.value[seatIndex];
      const newSeat: Seat = {
        index: seatIndex,
        user: user ? { ...user } : null,
        isMuted,
        isActive: user != null && audioState.value.activeSpeakerIds.includes(user.id),
        isLocked: currentSeat?.isLocked ?? false,
      };

      // Direct index assignment — Vue tracks ref array element mutations
      seats.value[seatIndex] = newSeat;

      // Update participant's speaker status
      if (user) {
        const participant = participants.value.get(user.id);
        if (participant) {
          participant.isSpeaker = true;
          participant.seatIndex = seatIndex;
        }
      }
    }
  }

  /**
   * Clear a seat (remove user).
   * @param seatIndex - Zero-based seat index (0-14)
   */
  function clearSeat(seatIndex: number) {
    if (seatIndex >= 0 && seatIndex < seats.value.length) {
      const seat = seats.value[seatIndex];
      const user = seat?.user;

      seats.value[seatIndex] = {
        index: seatIndex,
        user: null,
        isMuted: false,
        isActive: false,
        isLocked: seat?.isLocked ?? false, // Preserve lock state
      };

      // Update participant's speaker status
      if (user) {
        const participant = participants.value.get(user.id);
        if (participant) {
          participant.isSpeaker = false;
          participant.seatIndex = undefined;
        }
      }
    }
  }

  /**
   * Lock or unlock a seat (owner only).
   * @param seatIndex - Zero-based seat index (0-14)
   * @param isLocked - Whether seat should be locked
   */
  function setSeatLocked(seatIndex: number, isLocked: boolean) {
    const seat = seats.value[seatIndex];
    if (seatIndex >= 0 && seatIndex < seats.value.length && seat) {
      seat.isLocked = isLocked;
    }
  }

  // ========================================
  // Chat Actions
  // ========================================
  /**
   * Add a chat message to the message list.
   * @param message - Chat message event from server
   */
  function addMessage(message: ChatMessageEvent) {
    // Splice oldest at head instead of shift() to avoid O(n) reindex
    if (messages.value.length >= MAX_CHAT_MESSAGES) {
      messages.value.splice(0, 1);
    }
    messages.value.push(message);
  }

  function clearMessages() {
    messages.value = [];
  }

  // ========================================
  // Legacy Seat UI Actions
  // ========================================
  function openSeat(seatId: number) {
    activeSeat.value = seatId;
  }

  function closeSeat() {
    activeSeat.value = null;
  }

  // ========================================
  // Return
  // ========================================
  return {
    // Core state
    currentRoom,
    userRoom,
    isMinimized,
    previousRoute,
    status,

    // Audio state
    audioState,

    // Participants
    participants,
    participantList,

    // Seats
    seats,
    speakersCount,
    inviteModeSeat,

    // Chat
    messages,

    // Computed
    isRoomOwner,

    // Core actions
    minimizeRoom,
    maximizeRoom,
    updateStatus,
    setCurrentRoom,
    setUserRoom,
    leaveRoom,
    updateRoomLevel,
    updateParticipantCount,
    startInviteMode,
    cancelInviteMode,

    // Audio actions
    setAudioConnected,
    setProducing,
    setMuted,
    setActiveSpeakers,
    clearAudioState,

    // Participant actions
    addParticipant,
    removeParticipant,
    updateParticipantProfile,
    setParticipantMuted,

    // Seat actions
    updateSeat,
    clearSeat,
    setSeatLocked,

    // Chat actions
    addMessage,
    clearMessages,

    // Legacy seat UI
    activeSeat,
    openSeat,
    closeSeat,
  };
}, {
  persist: {
    pick: ['userRoom', 'currentRoom', 'isMinimized', 'previousRoute'],
  },
});
