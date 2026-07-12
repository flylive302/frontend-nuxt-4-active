import { defineStore } from 'pinia';
import type { types as mediasoupTypes } from 'mediasoup-client';

type Producer = mediasoupTypes.Producer;
type Consumer = mediasoupTypes.Consumer;

export const useMediasoupSessionStore = defineStore('mediasoupSession', () => {
  const producer = shallowRef<Producer | null>(null);
  const musicProducer = shallowRef<Producer | null>(null);
  const consumers = ref<Map<string, Consumer>>(new Map());
  const isLocalMuted = ref(false);
  const currentVolume = ref(1);
  const audioElements = ref<Map<string, HTMLAudioElement>>(new Map());
  // Keyed by `${userId}:${source}` (e.g. "42:mic") so a user's mic and music
  // producers are tracked independently — see docs/issues/dj-talk-over/01.
  const consumerProducerByKey = ref<Map<string, string>>(new Map());

  function addConsumer(producerId: string, consumer: Consumer): void {
    consumers.value.set(producerId, consumer);
  }

  function removeConsumer(producerId: string): void {
    consumers.value.delete(producerId);
  }

  function setVolume(volume: number): void {
    currentVolume.value = Math.max(0, Math.min(1, volume));
  }

  function $reset(): void {
    audioElements.value.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    audioElements.value.clear();
    consumers.value.clear();
    consumerProducerByKey.value.clear();
    producer.value = null;
    musicProducer.value = null;
    isLocalMuted.value = false;
    currentVolume.value = 1;
  }

  return {
    producer,
    musicProducer,
    consumers,
    isLocalMuted,
    currentVolume,
    audioElements,
    consumerProducerByKey,
    addConsumer,
    removeConsumer,
    setVolume,
    $reset,
  };
});
