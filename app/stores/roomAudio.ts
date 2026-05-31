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
  };
});
