/**
 * Mediasoup Facade - Backward-Compatible API
 * 
 * This file serves as a facade that combines the 3 specialized mediasoup composables:
 * - useMediasoupDevice: Device initialization
 * - useMediasoupTransports: Transport creation
 * - useMediasoupStreaming: Audio production/consumption
 * 
 * All existing code importing `useMediasoup` will continue to work unchanged.
 * This maintains backward compatibility while improving code organization.
 */
import type { Ref } from 'vue';
import type { AudioSocket } from '../room/useAudioSocket';
import { useMediasoupDevice } from './useMediasoupDevice';
import { useMediasoupTransports } from './useMediasoupTransports';
import { useMediasoupStreaming } from './useMediasoupStreaming';

/**
 * Mediasoup composable - unified facade for WebRTC functionality.
 * 
 * This combines device, transport, and streaming management into a single API.
 * Internally delegates to specialized composables for better code organization.
 * 
 * @param socket - Ref to the Socket.IO socket instance
 */
export function useMediasoup(socket: Ref<AudioSocket | null>) {
  // Get all sub-composables
  const deviceComposable = useMediasoupDevice();
  const transportsComposable = useMediasoupTransports(socket);
  const streamingComposable = useMediasoupStreaming(socket);

  // ========================================
  // Combined Cleanup
  // ========================================
  
  /**
   * Clean up all resources (device, transports, producers, consumers).
   */
  function cleanup(): void {
    streamingComposable.cleanup();
    transportsComposable.cleanup();
    deviceComposable.resetDevice();
  }

  // ========================================
  // Return Combined API
  // ========================================
  
  return {
    // Device
    device: deviceComposable.device,
    isDeviceLoaded: deviceComposable.isDeviceLoaded,
    loadDevice: deviceComposable.loadDevice,

    // Transports
    producerTransport: transportsComposable.producerTransport,
    consumerTransport: transportsComposable.consumerTransport,
    createTransports: transportsComposable.createTransports,

    // Streaming
    producer: streamingComposable.producer,
    consumers: streamingComposable.consumers,
    isProducing: streamingComposable.isProducing,
    isLocalMuted: streamingComposable.isLocalMuted,
    startAudio: streamingComposable.startAudio,
    stopAudio: streamingComposable.stopAudio,
    toggleLocalMute: streamingComposable.toggleLocalMute,
    consumeProducer: streamingComposable.consumeProducer,
    stopConsumer: streamingComposable.stopConsumer,

    // Combined cleanup
    cleanup,
  };
}
