import { defineStore } from 'pinia';
import type {
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

  const messages = ref<ChatMessageEvent[]>([]);

  /**
   * mic-fgs-crash 02 — a mic re-claim that was owed but deliberately NOT taken.
   *
   * Set when a (re)join finds us still seated while the app is hidden: opening
   * the mic there starts a `microphone` foreground service from the background,
   * which Android refuses and which killed the process. We rejoin and hold the
   * Seat as a silent occupant instead, and record the debt here. The resume path
   * settles it on `hidden → visible`.
   *
   * Deliberately its own ref rather than a field on `audioState`: that object is
   * the audio session's observable shape, and an "I owe you a producer" marker
   * is not part of it. `clearAudioState()` still clears it, so leaving the Room
   * drops any pending re-claim through the single existing reset path (spec D3)
   * and it can never fire later in an unrelated Room.
   */
  const pendingMicReclaim = ref(false);

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

  function setPendingMicReclaim(pending: boolean) {
    pendingMicReclaim.value = pending;
  }

  function clearAudioState() {
    audioState.value = {
      isConnected: false,
      isProducing: false,
      isMuted: false,
      activeSpeakerIds: [],
    };
    messages.value = [];
    pendingMicReclaim.value = false;
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

  /**
   * Patch an already-added message's content in place, by id. Used to update
   * a gift/lucky-win announcement bubble in place (combo-streak cumulative
   * quantity + total) without pushing a new message. No-op if the message has
   * since scrolled out of the `MAX_CHAT_MESSAGES` window.
   */
  function patchMessageContent(id: string, content: string) {
    const message = messages.value.find((m) => m.id === id);
    if (message) message.content = content;
  }

  return {
    audioState,
    setAudioConnected,
    setProducing,
    setMuted,
    setActiveSpeakers,
    pendingMicReclaim,
    setPendingMicReclaim,
    clearAudioState,
    messages,
    addMessage,
    clearMessages,
    patchMessageContent,
  };
});
