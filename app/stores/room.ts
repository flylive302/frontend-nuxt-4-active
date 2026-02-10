import { defineStore } from 'pinia';
import type { BootstrapRoom as Room } from '~/types/bootstrap';
import type {
  RoomParticipant,
  ChatMessageEvent,
  AudioState,
  Seat,
} from '~/types/audio';
import { SEAT_COUNT, MAX_CHAT_MESSAGES } from '~/constants/room';
import { createLogger } from '~/utils/logger';

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
    }
  }

  function maximizeRoom() {
    if (currentRoom.value) {
      isMinimized.value = false;
    }
  }

  function setCurrentRoom(room: Room | null) {
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
      currentRoom.value = {
        ...currentRoom.value,
        current_level: level,
        room_xp: xp,
      };
    }
  }

  /**
   * Update participant count from realtime event.
   * @param count - New participant count
   */
  function updateParticipantCount(count: number) {
    if (currentRoom.value) {
      currentRoom.value = {
        ...currentRoom.value,
        participant_count: count,
      };
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

    // Update seat active state
    seats.value.forEach((seat) => {
      seat.isActive = seat.user != null && userIds.includes(seat.user.id);
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
   * @param seatIndex - Zero-based seat index (0-14)
   * @param user - Participant to assign, or null to clear
   * @param isMuted - Whether user is server-muted
   */
  function updateSeat(seatIndex: number, user: RoomParticipant | null, isMuted: boolean) {
    if (seatIndex >= 0 && seatIndex < seats.value.length) {
      const log = createLogger('[RoomStore]');

      // DEBUG: Full dump of incoming user data
      log.debug('updateSeat called:', {
        seatIndex,
        userId: user?.id,
        userName: user?.name,
        avatar: user?.avatar,
        country: user?.country,
      });
      console.log('[RoomStore] FULL USER JSON:', JSON.stringify(user));
      console.trace('[RoomStore] updateSeat call stack');

      const currentSeat = seats.value[seatIndex];
      const newSeat: Seat = {
        index: seatIndex,
        user: user ? { ...user } : null, // Shallow clone to avoid reference issues
        isMuted,
        isActive: user != null && audioState.value.activeSpeakerIds.includes(user.id),
        isLocked: currentSeat?.isLocked ?? false, // Preserve lock state
      };

      console.log('[RoomStore] newSeat.user?.avatar:', newSeat.user?.avatar);

      // Force reactivity by creating new array reference
      seats.value = seats.value.map((s, i) => i === seatIndex ? newSeat : s);

      console.log('[RoomStore] AFTER MAP - avatar:', seats.value[seatIndex]?.user?.avatar);
      console.log('[RoomStore] AFTER MAP - FULL SEAT:', JSON.stringify(seats.value[seatIndex]));

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
    messages.value.push(message);

    // Keep last MAX_CHAT_MESSAGES messages to prevent memory issues
    if (messages.value.length > MAX_CHAT_MESSAGES) {
      messages.value = messages.value.slice(-MAX_CHAT_MESSAGES);
    }
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
    pick: ['userRoom'],
  },
});
