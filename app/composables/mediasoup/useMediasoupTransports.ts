import type { types as mediasoupTypes } from 'mediasoup-client';
import type {
  DtlsParameters,
  TransportCreateResponse,
  TransportConnectResponse,
  AudioProduceResponse,
} from '~/types/room/audio';
import type { AudioSocket } from '../room/useAudioSocket';
import { useMediasoupDevice } from './useMediasoupDevice';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';

// ============================================
// Types
// ============================================
type Transport = mediasoupTypes.Transport;

// ============================================
// Shared State (Module-level Singleton)
// ============================================
const producerTransport = ref<Transport | null>(null);
const consumerTransport = ref<Transport | null>(null);
const currentRoomId = ref<string | null>(null);

// Cached to prevent inject() warning when called outside Vue setup context
let _toast: ReturnType<typeof useToast> | null = null;

// ============================================
// Composable
// ============================================

/**
 * Mediasoup Transport Management
 * 
 * Handles creation and connection of producer/consumer transports.
 * Requires device to be loaded first.
 */
export function useMediasoupTransports(socket: Ref<AudioSocket | null>) {
  const log = createLogger('[MediasoupTransports]');
  const emitAsync = createEmitAsync(socket);
  if (!_toast) _toast = useToast();
  const toast = _toast;

  // Get device from device composable
  const { device } = useMediasoupDevice();

  // Diagnose European/symmetric-NAT failures: log whether the server handed us
  // TURN candidates (only `stun:` URLs means TURN is unavailable for this user).
  function logIceServers(label: string, iceServers: RTCIceServer[] | undefined) {
    if (!iceServers || iceServers.length === 0) {
      return;
    }
    const schemes = new Set<string>();
    for (const server of iceServers) {
      const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
      for (const url of urls) {
        const scheme = url.split(':', 1)[0];
        if (scheme) schemes.add(scheme);
      }
    }
  }

  function attachFailureListener(transport: Transport, label: string) {
    transport.on('connectionstatechange', (state: mediasoupTypes.ConnectionState) => {
      if (state === 'failed') {
        toast.add({
          title: 'Audio connection failed',
          description: 'Your network may be blocking the audio relay. Try a different network or check firewall settings.',
          color: 'error',
        });
      }
    });
  }

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Create producer and consumer transports for the room.
   * Must be called after loadDevice().
   * 
   * @param roomId - Room ID to create transports for
   */
  async function createTransports(roomId: string): Promise<void> {
    if (!device.value?.loaded) {
      throw new Error('Device not loaded');
    }

    // Defensive: close stale transports from previous room session
    if (consumerTransport.value) {
      consumerTransport.value.close();
      consumerTransport.value = null;
    }
    if (producerTransport.value) {
      producerTransport.value.close();
      producerTransport.value = null;
    }

    currentRoomId.value = roomId;

    // Create consumer transport (for receiving audio)
    const consumerResponse = await emitAsync<{ type: string; roomId: string }, TransportCreateResponse>(
      'transport:create',
      { type: 'consumer', roomId }
    );

    if (!consumerResponse.success || !consumerResponse.data) {
      throw new Error(consumerResponse.error || 'Failed to create consumer transport');
    }

    logIceServers('Consumer transport', consumerResponse.data.iceServers);

    consumerTransport.value = device.value.createRecvTransport({
      id: consumerResponse.data.id,
      iceParameters: consumerResponse.data.iceParameters,
      iceCandidates: consumerResponse.data.iceCandidates,
      dtlsParameters: consumerResponse.data.dtlsParameters,
      iceServers: consumerResponse.data.iceServers,
    });

    attachFailureListener(consumerTransport.value, 'Consumer transport');

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
            if (!response.success) {
              errback(new Error(response.error || 'Transport connect failed'));
            } else {
              callback();
            }
          })
          .catch(errback);
      }
    );

  }

  /**
   * Create producer transport (called when user wants to speak)
   */
  async function createProducerTransport(): Promise<void> {
    // Enhanced debugging for seat-taking issue

    if (!device.value?.loaded || !currentRoomId.value) {
      throw new Error('Device not loaded or room not joined');
    }

    if (producerTransport.value) {
      return;
    }

    const response = await emitAsync<{ type: string; roomId: string }, TransportCreateResponse>(
      'transport:create',
      { type: 'producer', roomId: currentRoomId.value }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create producer transport');
    }

    logIceServers('Producer transport', response.data.iceServers);

    producerTransport.value = device.value.createSendTransport({
      id: response.data.id,
      iceParameters: response.data.iceParameters,
      iceCandidates: response.data.iceCandidates,
      dtlsParameters: response.data.dtlsParameters,
      iceServers: response.data.iceServers,
    });

    attachFailureListener(producerTransport.value, 'Producer transport');

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
            if (!response.success) {
              errback(new Error(response.error || 'Transport connect failed'));
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
            if (!response.success || !response.data) {
              errback(new Error(response.error || 'Failed to produce'));
            } else {
              callback({ id: response.data.id });
            }
          })
          .catch(errback);
      }
    );

  }

  /**
   * Clean up all transports
   */
  function cleanup(): void {
    if (producerTransport.value) {
      producerTransport.value.close();
      producerTransport.value = null;
    }

    if (consumerTransport.value) {
      consumerTransport.value.close();
      consumerTransport.value = null;
    }

    currentRoomId.value = null;
  }

  // ========================================
  // Return
  // ========================================
  return {
    producerTransport,
    consumerTransport,
    createTransports,
    createProducerTransport,
    cleanup,
  };
}
