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
    messages.value = [];
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
    clearAudioState,
    messages,
    addMessage,
    clearMessages,
    patchMessageContent,
  };
});
