import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Room } from '~/types/room';
import type {
  RoomParticipant,
  ChatMessageEvent,
  GiftReceivedEvent,
  AudioState,
  Seat,
} from '~/types/audio';

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
    activeSpeakerId: null,
  });

  // ========================================
  // Participants
  // ========================================
  const participants = ref<Map<number, RoomParticipant>>(new Map());

  // ========================================
  // Seats (15 speaker seats)
  // ========================================
  const seats = ref<Seat[]>(
    Array.from({ length: 15 }, (_, i) => ({
      index: i,
      user: null,
      isMuted: false,
      isActive: false,
    }))
  );

  // ========================================
  // Chat Messages (Ephemeral)
  // ========================================
  const messages = ref<ChatMessageEvent[]>([]);

  // ========================================
  // Last Gift (for animations)
  // ========================================
  const lastGift = ref<GiftReceivedEvent | null>(null);

  // ========================================
  // Legacy Seat UI State
  // ========================================
  const activeSeat = ref<number | null>(null);

  // ========================================
  // Computed
  // ========================================
  const participantList = computed(() => Array.from(participants.value.values()));
  const speakersCount = computed(() => seats.value.filter((s) => s.user !== null).length);
  const isRoomOwner = computed(() => {
    if (!currentRoom.value || !userRoom.value) return false;
    return currentRoom.value.id === userRoom.value.id;
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

  // ========================================
  // Audio State Actions
  // ========================================
  function setAudioConnected(connected: boolean) {
    audioState.value.isConnected = connected;
  }

  function setProducing(producing: boolean) {
    audioState.value.isProducing = producing;
  }

  function setMuted(muted: boolean) {
    audioState.value.isMuted = muted;
  }

  function setActiveSpeaker(userId: number | null) {
    audioState.value.activeSpeakerId = userId;

    // Update seat active state
    seats.value.forEach((seat) => {
      seat.isActive = seat.user?.id === userId;
    });
  }

  function clearAudioState() {
    audioState.value = {
      isConnected: false,
      isProducing: false,
      isMuted: false,
      activeSpeakerId: null,
    };
    participants.value.clear();
    messages.value = [];
    lastGift.value = null;
    seats.value = Array.from({ length: 15 }, (_, i) => ({
      index: i,
      user: null,
      isMuted: false,
      isActive: false,
    }));
  }

  // ========================================
  // Participant Actions
  // ========================================
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
  function updateSeat(seatIndex: number, user: RoomParticipant | null, isMuted: boolean) {
    if (seatIndex >= 0 && seatIndex < seats.value.length) {
      seats.value[seatIndex] = {
        index: seatIndex,
        user,
        isMuted,
        isActive: audioState.value.activeSpeakerId === user?.id,
      };

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

  function clearSeat(seatIndex: number) {
    if (seatIndex >= 0 && seatIndex < seats.value.length) {
      const seat = seats.value[seatIndex];
      const user = seat?.user;

      seats.value[seatIndex] = {
        index: seatIndex,
        user: null,
        isMuted: false,
        isActive: false,
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

  // ========================================
  // Chat Actions
  // ========================================
  function addMessage(message: ChatMessageEvent) {
    messages.value.push(message);

    // Keep last 500 messages to prevent memory issues
    if (messages.value.length > 500) {
      messages.value = messages.value.slice(-500);
    }
  }

  function clearMessages() {
    messages.value = [];
  }

  // ========================================
  // Gift Actions
  // ========================================
  function handleGiftReceived(gift: GiftReceivedEvent) {
    lastGift.value = gift;

    // Auto-clear after animation duration
    setTimeout(() => {
      if (lastGift.value === gift) {
        lastGift.value = null;
      }
    }, 5000);
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

    // Chat
    messages,

    // Gifts
    lastGift,

    // Computed
    isRoomOwner,

    // Core actions
    minimizeRoom,
    maximizeRoom,
    updateStatus,
    setCurrentRoom,
    setUserRoom,
    leaveRoom,

    // Audio actions
    setAudioConnected,
    setProducing,
    setMuted,
    setActiveSpeaker,
    clearAudioState,

    // Participant actions
    addParticipant,
    removeParticipant,
    setParticipantMuted,

    // Seat actions
    updateSeat,
    clearSeat,

    // Chat actions
    addMessage,
    clearMessages,

    // Gift actions
    handleGiftReceived,

    // Legacy seat UI
    activeSeat,
    openSeat,
    closeSeat,
  };
}, {
  persist: {
    pick: ['userRoom', 'currentRoom'],
  },
});
