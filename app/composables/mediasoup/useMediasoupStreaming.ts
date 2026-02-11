import type { types as mediasoupTypes } from 'mediasoup-client';
import type {
  AudioConsumeResponse,
  ConsumerResumeResponse,
} from '~/types/audio';
import type { AudioSocket } from '../useAudioSocket';
import { useMediasoupDevice } from './useMediasoupDevice';
import { useMediasoupTransports } from './useMediasoupTransports';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';

// ============================================
// Types
// ============================================
type Producer = mediasoupTypes.Producer;
type Consumer = mediasoupTypes.Consumer;

// ============================================
// Shared State (Module-level Singleton)
// ============================================
const producer = ref<Producer | null>(null);
const consumers = ref<Map<string, Consumer>>(new Map());
const isLocalMuted = ref(false);

// ============================================
// Composable
// ============================================

/**
 * Mediasoup Audio Streaming
 * 
 * Handles audio production (microphone) and consumption (remote speakers).
 * Requires device and transports to be initialized first.
 */
export function useMediasoupStreaming(socket: Ref<AudioSocket | null>) {
  const log = createLogger('[MediasoupStreaming]');
  const emitAsync = createEmitAsync(socket);

  // Get device and transports from other composables
  const { device } = useMediasoupDevice();
  const { producerTransport, consumerTransport, createProducerTransport } = useMediasoupTransports(socket);

  // ========================================
  // Computed Properties
  // ========================================
  const isProducing = computed(() => producer.value !== null && !producer.value.closed);

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Start producing audio from the microphone.
   * Creates producer transport if not exists.
   */
  async function startAudio(): Promise<void> {
    // Create producer transport if needed
    if (!producerTransport.value) {
      await createProducerTransport();
    }

    // Get microphone access
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const track = stream.getAudioTracks()[0];

    // Produce the audio track
    producer.value = await producerTransport.value!.produce({ track });

    producer.value.on('transportclose', () => {
      log.debug('Producer transport closed');
      producer.value = null;
    });

    producer.value.on('trackended', () => {
      log.debug('Producer track ended');
      stopAudio();
    });

    log.debug('Started producing audio:', producer.value.id);
  }

  /**
   * Stop producing audio and close the producer.
   */
  function stopAudio(): void {
    if (producer.value) {
      producer.value.close();
      producer.value = null;
      isLocalMuted.value = false;
      log.debug('Stopped producing audio');
    }
  }

  /**
   * Toggle local microphone mute (pauses/resumes the track, not the producer).
   * This mutes locally - other users won't hear audio until unmuted.
   */
  function toggleLocalMute(): boolean {
    if (!producer.value) {
      log.warn('Cannot toggle mute: no active producer');
      return isLocalMuted.value;
    }

    const track = producer.value.track;
    if (track) {
      isLocalMuted.value = !isLocalMuted.value;
      track.enabled = !isLocalMuted.value;
      log.debug('Local mute toggled:', isLocalMuted.value ? 'muted' : 'unmuted');
    }

    return isLocalMuted.value;
  }

  /**
   * Consume audio from a remote producer.
   * 
   * @param producerId - ID of the remote producer to consume
   * @param roomId - Room ID for the consume request
   */
  async function consumeProducer(producerId: string, roomId: string): Promise<void> {
    if (!device.value?.loaded || !consumerTransport.value) {
      log.error('Cannot consume: device or transport not ready');
      return;
    }

    // Check if already consuming
    if (consumers.value.has(producerId)) {
      log.debug('Already consuming producer:', producerId);
      return;
    }

    const response = await emitAsync<object, AudioConsumeResponse>('audio:consume', {
      roomId,
      transportId: consumerTransport.value.id,
      producerId,
      rtpCapabilities: device.value.rtpCapabilities,
    });

    if (!response.success || !response.data) {
      log.error('Failed to consume:', response.error);
      return;
    }

    const consumer = await consumerTransport.value.consume({
      id: response.data.id,
      producerId: response.data.producerId,
      kind: response.data.kind,
      rtpParameters: response.data.rtpParameters,
    });

    consumers.value.set(producerId, consumer);

    // Resume the consumer (consumers start paused)
    const resumeResponse = await emitAsync<object, ConsumerResumeResponse>('consumer:resume', {
      roomId,
      consumerId: consumer.id,
    });

    if (!resumeResponse.success) {
      log.error('Failed to resume consumer:', resumeResponse.error);
      return;
    }

    // Attach to audio element
    const audio = new Audio();
    audio.srcObject = new MediaStream([consumer.track]);

    // Try to play, handling autoplay policy
    const playAudio = async () => {
      try {
        await audio.play();
        log.debug('Audio playing for producer:', producerId);
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          // Autoplay blocked - wait for user interaction
          log.warn('Autoplay blocked, waiting for user interaction');

          // Add a one-time click listener to resume playback
          const resumePlayback = async () => {
            try {
              await audio.play();
              log.debug('Audio resumed after user interaction');
            } catch (e) {
              log.error('Still failed to play after interaction:', e);
            }
            document.removeEventListener('click', resumePlayback);
            document.removeEventListener('touchstart', resumePlayback);
          };

          document.addEventListener('click', resumePlayback, { once: true });
          document.addEventListener('touchstart', resumePlayback, { once: true });
        } else {
          log.error('Failed to play audio:', err);
        }
      }
    };

    playAudio();

    consumer.on('transportclose', () => {
      log.debug('Consumer transport closed for:', producerId);
      consumers.value.delete(producerId);
    });

    log.debug('Started consuming producer:', producerId);
  }

  /**
   * Stop consuming from a specific producer.
   * 
   * @param producerId - ID of the producer to stop consuming
   */
  function stopConsumer(producerId: string): void {
    const consumer = consumers.value.get(producerId);
    if (consumer) {
      consumer.close();
      consumers.value.delete(producerId);
      log.debug('Stopped consuming producer:', producerId);
    }
  }

  /**
   * Clean up all producers and consumers
   */
  function cleanup(): void {
    // Close producer
    stopAudio();

    // Close all consumers
    consumers.value.forEach((consumer) => consumer.close());
    consumers.value.clear();

    log.debug('Streaming cleanup complete');
  }

  // ========================================
  // Return
  // ========================================
  return {
    producer,
    consumers,
    isProducing,
    isLocalMuted,
    startAudio,
    stopAudio,
    toggleLocalMute,
    consumeProducer,
    stopConsumer,
    cleanup,
  };
}
