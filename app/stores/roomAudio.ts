import { defineStore } from 'pinia';
import type {
  RoomParticipant,
  ChatMessageEvent,
  AudioState,
} from '~/types/room/audio';
import { MAX_CHAT_MESSAGES } from '~/constants/room';

export const useRoomAudioStore = defineStore('roomAudioStore', () => {
  const audioState = ref<AudioState>({
    isConnected: false,
    isProducing: false,
    isMuted: false,
    activeSpeakerIds: [],
  });

  const participants = ref<Map<number, RoomParticipant>>(new Map());
  const messages = ref<ChatMessageEvent[]>([]);

  const participantList = computed(() => Array.from(participants.value.values()));

  function setAudioConnected(connected: boolean) {
    audioState.value.isConnected = connected;
  }

  function setProducing(producing: boolean) {
    audioState.value.isProducing = producing;
  }

  function setMuted(muted: boolean) {
    audioState.value.isMuted = muted;
  }

  function setActiveSpeakers(userIds: number[]) {
    audioState.value.activeSpeakerIds = userIds;
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
  }

  function addParticipant(user: RoomParticipant) {
    participants.value.set(user.id, user);
  }

  function removeParticipant(userId: number) {
    participants.value.delete(userId);
  }

  /**
   * Reconcile the participant set against an authoritative join snapshot.
   *
   * The join response is the source of truth: anyone present is upserted,
   * anyone absent is pruned. Without this the Map only ever grows (every
   * re-join MERGES the snapshot onto stale state), so a participant who left
   * while we were disconnected lingers forever and the displayed count drifts.
   *
   * Upsert/prune is done in place (not a wholesale Map replace) to preserve
   * object identity for unchanged participants — avoids list re-render churn.
   * `keepSelfId` shields the local user, who is added separately by joinRoom
   * and never appears in the snapshot's `participants` array.
   */
  function reconcileParticipants(snapshot: RoomParticipant[], keepSelfId?: number) {
    const keep = new Set(snapshot.map((p) => p.id));
    if (keepSelfId != null) keep.add(keepSelfId);

    for (const id of [...participants.value.keys()]) {
      if (!keep.has(id)) participants.value.delete(id);
    }

    for (const p of snapshot) {
      const existing = participants.value.get(p.id);
      if (existing) Object.assign(existing, p);
      else participants.value.set(p.id, p);
    }
  }

  function updateParticipantProfile(userId: number, profile: Partial<RoomParticipant>) {
    const participant = participants.value.get(userId);
    if (!participant) return;
    Object.assign(participant, profile);
  }

  function setParticipantMuted(userId: number, isMuted: boolean) {
    const participant = participants.value.get(userId);
    if (participant) {
      participant.isMuted = isMuted;
    }
  }

  function addMessage(message: ChatMessageEvent) {
    if (messages.value.length >= MAX_CHAT_MESSAGES) {
      messages.value.splice(0, 1);
    }
    messages.value.push(message);
  }

  function clearMessages() {
    messages.value = [];
  }

  return {
    audioState,
    setAudioConnected,
    setProducing,
    setMuted,
    setActiveSpeakers,
    clearAudioState,
    participants,
    participantList,
    addParticipant,
    removeParticipant,
    reconcileParticipants,
    updateParticipantProfile,
    setParticipantMuted,
    messages,
    addMessage,
    clearMessages,
  };
});
