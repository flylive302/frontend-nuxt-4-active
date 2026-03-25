import { defineStore } from 'pinia';
import type {
  RoomParticipant,
  ChatMessageEvent,
  AudioState,
} from '~/types/room/audio';
import { MAX_CHAT_MESSAGES } from '~/constants/room';

// ============================================
// Store
// ============================================
export const useRoomAudioStore = defineStore('roomAudioStore', () => {
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
  // Chat Messages (Ephemeral)
  // ========================================
  const messages = ref<ChatMessageEvent[]>([]);

  // ========================================
  // Computed
  // ========================================
  const participantList = computed(() => Array.from(participants.value.values()));

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

  /**
   * Set which speakers are currently active (top 3).
   * Also updates seat isActive state in the seats store.
   */
  function setActiveSpeakers(userIds: number[]) {
    audioState.value.activeSpeakerIds = userIds;

    // Update seat active state in seats store
    const seatsStore = useRoomSeatsStore();
    seatsStore.syncActiveSpeakers(userIds);
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

    // Also clear seats store
    const seatsStore = useRoomSeatsStore();
    seatsStore.resetSeats();
  }

  // ========================================
  // Participant Actions
  // ========================================

  function addParticipant(user: RoomParticipant) {
    participants.value.set(user.id, user);
  }

  function removeParticipant(userId: number) {
    participants.value.delete(userId);

    // Clear from seats store
    const seatsStore = useRoomSeatsStore();
    seatsStore.clearParticipantFromSeat(userId);
  }

  /**
   * Update a participant's profile data in-place.
   * Also refreshes the user's seat snapshot so seated users show fresh data.
   */
  function updateParticipantProfile(userId: number, profile: Partial<RoomParticipant>) {
    const participant = participants.value.get(userId);
    if (!participant) return;

    // Merge profile fields into existing participant
    Object.assign(participant, profile);

    // Refresh seat snapshot if user is seated
    const seatsStore = useRoomSeatsStore();
    seatsStore.refreshSeatUser(userId, participant);

    // Refresh room owner snapshot so header avatar stays current
    const roomStore = useRoomStore();
    if (roomStore.currentRoom?.owner?.id === userId) {
      roomStore.refreshCurrentRoom({
        ...roomStore.currentRoom,
        owner: { ...roomStore.currentRoom.owner, ...profile },
      });
    }
  }

  function setParticipantMuted(userId: number, isMuted: boolean) {
    const participant = participants.value.get(userId);
    if (participant) {
      participant.isMuted = isMuted;
    }

    // Update seat if user is seated
    const seatsStore = useRoomSeatsStore();
    seatsStore.setSeatUserMuted(userId, isMuted);
  }

  // ========================================
  // Chat Actions
  // ========================================

  function addMessage(message: ChatMessageEvent) {
    if (messages.value.length >= MAX_CHAT_MESSAGES) {
      messages.value.splice(0, 1);
    }
    messages.value.push(message);
  }

  function clearMessages() {
    messages.value = [];
  }

  // ========================================
  // Return
  // ========================================
  return {
    // Audio state
    audioState,
    setAudioConnected,
    setProducing,
    setMuted,
    setActiveSpeakers,
    clearAudioState,

    // Participants
    participants,
    participantList,
    addParticipant,
    removeParticipant,
    updateParticipantProfile,
    setParticipantMuted,

    // Chat
    messages,
    addMessage,
    clearMessages,
  };
});
