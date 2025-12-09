import type { types as mediasoupTypes } from 'mediasoup-client';
import { Device } from 'mediasoup-client';
import type {
  RtpCapabilities,
  DtlsParameters,
  TransportCreateResponse,
  TransportConnectResponse,
  AudioProduceResponse,
  AudioConsumeResponse,
  ConsumerResumeResponse,
} from '~/types/audio';
import type { AudioSocket } from './useAudioSocket';

// ============================================
// Types from mediasoup-client
// ============================================
type Transport = mediasoupTypes.Transport;
type Producer = mediasoupTypes.Producer;
type Consumer = mediasoupTypes.Consumer;

// ============================================
// Shared State (Module-level Singleton)
// ============================================
// CRITICAL: These must be at module level to be shared across all component instances.
// Without this, each component calling useMediasoup() would get its own isolated state.

const device = ref<Device | null>(null);
const producerTransport = ref<Transport | null>(null);
const consumerTransport = ref<Transport | null>(null);
const producer = ref<Producer | null>(null);
const consumers = ref<Map<string, Consumer>>(new Map());

// Track the current room for transport operations
const currentRoomId = ref<string | null>(null);

// ============================================
// Composable
// ============================================

/**
 * Composable for managing Mediasoup WebRTC transports, producers, and consumers.
 * Handles device initialization, transport creation, and audio streaming.
 * 
 * NOTE: This uses module-level state to ensure all components share
 * the same Mediasoup state. This is intentional singleton behavior.
 *
 * @param socket - Ref to the Socket.IO socket instance
 */
export function useMediasoup(socket: Ref<AudioSocket | null>) {
  // ========================================
  // Computed Properties
  // ========================================
  const isDeviceLoaded = computed(() => device.value?.loaded ?? false);
  const isProducing = computed(() => producer.value !== null && !producer.value.closed);

  // ========================================
  // Private Helpers
  // ========================================

  /**
   * Emit socket event with promise-based response
   */
  function emitAsync<TPayload, TResponse>(
    event: string,
    payload: TPayload
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      if (!socket.value) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.value.emit(event, payload, (response: TResponse) => {
        resolve(response);
      });
    });
  }

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Load the mediasoup device with RTP capabilities from the server.
   * Must be called before creating transports.
   */
  async function loadDevice(rtpCapabilities: RtpCapabilities): Promise<void> {
    if (device.value?.loaded) {
      console.log('[Mediasoup] Device already loaded');
      return;
    }

    device.value = new Device();
    await device.value.load({ routerRtpCapabilities: rtpCapabilities });
    console.log('[Mediasoup] Device loaded');
  }

  /**
   * Create producer and consumer transports for the room.
   * Must be called after loadDevice().
   */
  async function createTransports(roomId: string): Promise<void> {
    if (!device.value?.loaded) {
      throw new Error('Device not loaded');
    }

    currentRoomId.value = roomId;

    // Create consumer transport (for receiving audio)
    const consumerResponse = await emitAsync<{ type: string; roomId: string }, TransportCreateResponse>(
      'transport:create',
      { type: 'consumer', roomId }
    );

    if (consumerResponse.error || !consumerResponse.id) {
      throw new Error(consumerResponse.error || 'Failed to create consumer transport');
    }

    consumerTransport.value = device.value.createRecvTransport({
      id: consumerResponse.id,
      iceParameters: consumerResponse.iceParameters!,
      iceCandidates: consumerResponse.iceCandidates!,
      dtlsParameters: consumerResponse.dtlsParameters!,
    });

    // Handle consumer transport connection
    consumerTransport.value.on(
      'connect',
      (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback: () => void,
        errback: (error: Error) => void
      ) => {
        emitAsync<object, TransportConnectResponse>('transport:connect', {
          roomId: currentRoomId.value,
          transportId: consumerTransport.value!.id,
          dtlsParameters,
        })
          .then((response) => {
            if (response.error) {
              errback(new Error(response.error));
            } else {
              callback();
            }
          })
          .catch(errback);
      }
    );

    console.log('[Mediasoup] Consumer transport created');
  }

  /**
   * Create producer transport (called when user wants to speak)
   */
  async function createProducerTransport(): Promise<void> {
    if (!device.value?.loaded || !currentRoomId.value) {
      throw new Error('Device not loaded or room not joined');
    }

    if (producerTransport.value) {
      console.log('[Mediasoup] Producer transport already exists');
      return;
    }

    const response = await emitAsync<{ type: string; roomId: string }, TransportCreateResponse>(
      'transport:create',
      { type: 'producer', roomId: currentRoomId.value }
    );

    if (response.error || !response.id) {
      throw new Error(response.error || 'Failed to create producer transport');
    }

    producerTransport.value = device.value.createSendTransport({
      id: response.id,
      iceParameters: response.iceParameters!,
      iceCandidates: response.iceCandidates!,
      dtlsParameters: response.dtlsParameters!,
    });

    // Handle producer transport connection
    producerTransport.value.on(
      'connect',
      (
        { dtlsParameters }: { dtlsParameters: DtlsParameters },
        callback: () => void,
        errback: (error: Error) => void
      ) => {
        emitAsync<object, TransportConnectResponse>('transport:connect', {
          roomId: currentRoomId.value,
          transportId: producerTransport.value!.id,
          dtlsParameters,
        })
          .then((response) => {
            if (response.error) {
              errback(new Error(response.error));
            } else {
              callback();
            }
          })
          .catch(errback);
      }
    );

    // Handle produce event
    producerTransport.value.on(
      'produce',
      (
        { kind, rtpParameters }: { kind: mediasoupTypes.MediaKind; rtpParameters: mediasoupTypes.RtpParameters },
        callback: (params: { id: string }) => void,
        errback: (error: Error) => void
      ) => {
        emitAsync<object, AudioProduceResponse>('audio:produce', {
          roomId: currentRoomId.value,
          transportId: producerTransport.value!.id,
          kind,
          rtpParameters,
        })
          .then((response) => {
            if (response.error || !response.id) {
              errback(new Error(response.error || 'Failed to produce'));
            } else {
              callback({ id: response.id });
            }
          })
          .catch(errback);
      }
    );

    console.log('[Mediasoup] Producer transport created');
  }

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
      console.log('[Mediasoup] Producer transport closed');
      producer.value = null;
    });

    producer.value.on('trackended', () => {
      console.log('[Mediasoup] Producer track ended');
      stopAudio();
    });

    console.log('[Mediasoup] Started producing audio:', producer.value.id);
  }

  /**
   * Stop producing audio and close the producer.
   */
  function stopAudio(): void {
    if (producer.value) {
      producer.value.close();
      producer.value = null;
      console.log('[Mediasoup] Stopped producing audio');
    }
  }

  /**
   * Consume audio from a remote producer.
   */
  async function consumeProducer(producerId: string, roomId: string): Promise<void> {
    if (!device.value?.loaded || !consumerTransport.value) {
      console.error('[Mediasoup] Cannot consume: device or transport not ready');
      return;
    }

    // Check if already consuming
    if (consumers.value.has(producerId)) {
      console.log('[Mediasoup] Already consuming producer:', producerId);
      return;
    }

    const response = await emitAsync<object, AudioConsumeResponse>('audio:consume', {
      roomId,
      transportId: consumerTransport.value.id,
      producerId,
      rtpCapabilities: device.value.rtpCapabilities,
    });

    if (response.error || !response.id) {
      console.error('[Mediasoup] Failed to consume:', response.error);
      return;
    }

    const consumer = await consumerTransport.value.consume({
      id: response.id,
      producerId: response.producerId!,
      kind: response.kind!,
      rtpParameters: response.rtpParameters!,
    });

    consumers.value.set(producerId, consumer);

    // Resume the consumer (consumers start paused)
    const resumeResponse = await emitAsync<object, ConsumerResumeResponse>('consumer:resume', {
      roomId,
      consumerId: consumer.id,
    });

    if (resumeResponse.error) {
      console.error('[Mediasoup] Failed to resume consumer:', resumeResponse.error);
      return;
    }

    // Attach to audio element
    const audio = new Audio();
    audio.srcObject = new MediaStream([consumer.track]);
    
    // Try to play, handling autoplay policy
    const playAudio = async () => {
      try {
        await audio.play();
        console.log('[Mediasoup] Audio playing for producer:', producerId);
      } catch (err) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          // Autoplay blocked - wait for user interaction
          console.warn('[Mediasoup] Autoplay blocked, waiting for user interaction');
          
          // Add a one-time click listener to resume playback
          const resumePlayback = async () => {
            try {
              await audio.play();
              console.log('[Mediasoup] Audio resumed after user interaction');
            } catch (e) {
              console.error('[Mediasoup] Still failed to play after interaction:', e);
            }
            document.removeEventListener('click', resumePlayback);
            document.removeEventListener('touchstart', resumePlayback);
          };
          
          document.addEventListener('click', resumePlayback, { once: true });
          document.addEventListener('touchstart', resumePlayback, { once: true });
        } else {
          console.error('[Mediasoup] Failed to play audio:', err);
        }
      }
    };
    
    playAudio();

    consumer.on('transportclose', () => {
      console.log('[Mediasoup] Consumer transport closed for:', producerId);
      consumers.value.delete(producerId);
    });

    console.log('[Mediasoup] Started consuming producer:', producerId);
  }

  /**
   * Stop consuming from a specific producer.
   */
  function stopConsumer(producerId: string): void {
    const consumer = consumers.value.get(producerId);
    if (consumer) {
      consumer.close();
      consumers.value.delete(producerId);
      console.log('[Mediasoup] Stopped consuming producer:', producerId);
    }
  }

  /**
   * Clean up all resources.
   */
  function cleanup(): void {
    // Close producer
    stopAudio();

    // Close all consumers
    consumers.value.forEach((consumer) => consumer.close());
    consumers.value.clear();

    // Close transports
    if (producerTransport.value) {
      producerTransport.value.close();
      producerTransport.value = null;
    }

    if (consumerTransport.value) {
      consumerTransport.value.close();
      consumerTransport.value = null;
    }

    // Reset device
    device.value = null;
    currentRoomId.value = null;

    console.log('[Mediasoup] Cleanup complete');
  }


  // NOTE: We intentionally do NOT use onUnmounted here because this is shared state.
  // Cleaning up when one component unmounts would break all other components.
  // The cleanup() method should be called explicitly when leaving a room.

  // ========================================
  // Return
  // ========================================
  return {
    device,
    isDeviceLoaded,
    producerTransport,
    consumerTransport,
    producer,
    consumers,
    isProducing,
    loadDevice,
    createTransports,
    startAudio,
    stopAudio,
    consumeProducer,
    stopConsumer,
    cleanup,
  };
}
