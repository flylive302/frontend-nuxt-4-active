import type { types as mediasoupTypes } from 'mediasoup-client';
import type {
  DtlsParameters,
  TransportCreateResponse,
  TransportConnectResponse,
  AudioProduceResponse,
  ProducerSource,
} from '~/types/room/audio';
import * as Sentry from '@sentry/nuxt';
import type { AudioSocket } from '../room/useAudioSocket';
import { useMediasoupDevice } from './useMediasoupDevice';
import { attachTransportRecovery, type TransportRecoveryHandle } from './useTransportRecovery';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';

const logger = createLogger('[TransportRecovery]');

// ============================================
// Types
// ============================================
type Transport = mediasoupTypes.Transport;

// ============================================
// Shared State (Module-level Singleton)
// ============================================
const producerTransport = shallowRef<Transport | null>(null);
const consumerTransport = shallowRef<Transport | null>(null);
const currentRoomId = ref<string | null>(null);

// Recovery engines follow their transport's lifetime (msab-load-stability 10).
const recoveryHandles = new Map<string, TransportRecoveryHandle>();

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

  /**
   * msab-load-stability 10: `failed` is no longer terminal. The recovery
   * engine attempts bounded ICE restarts (server hands fresh ICE creds via
   * `transport:restartIce`); the toast is last-resort, shown only after
   * recovery is exhausted — and the terminal branch reports to Sentry with
   * recovery + gift-load context (this path produced zero events before).
   */
  function attachFailureListener(transport: Transport, label: string) {
    recoveryHandles.get(transport.id)?.dispose();
    recoveryHandles.set(transport.id, attachTransportRecovery(transport, {
      requestIceRestart: async () => {
        const response = await emitAsync<object, { success: boolean; data?: { iceParameters: mediasoupTypes.IceParameters }; error?: string }>(
          'transport:restartIce',
          { roomId: currentRoomId.value, transportId: transport.id },
        );
        if (response.success && response.data) return response.data.iceParameters;
        // prod-bugs 03: MSAB's typed refusal for a closed/torn-down transport —
        // retrying is futile; the engine goes terminal instead of burning attempts.
        if (response.error === 'Transport not found') return 'transport-gone';
        return null;
      },
      onRecovered: ({ attempts }) => {
        logger.info(`${label} recovered after ICE restart`, { attempts });
      },
      onExhausted: ({ attempts, reason }) => {
        const giftStore = useGiftStore();
        Sentry.captureMessage('Audio transport failed after recovery exhausted', {
          level: 'error',
          tags: { transport: label, reason },
          extra: {
            attempts,
            giftQueueDepth: giftStore.playbackQueue.length,
            giftPlaying: giftStore.isPlaying,
          },
        });
        toast.add({
          title: 'Audio connection failed',
          description: 'We tried to reconnect your audio but couldn\'t. Try a different network or check firewall settings.',
          color: 'error',
        });
      },
      log: (msg, data) => logger.info(`${label}: ${msg}`, data),
    }));
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
      disposeRecovery(consumerTransport.value);
      consumerTransport.value.close();
      consumerTransport.value = null;
    }
    if (producerTransport.value) {
      disposeRecovery(producerTransport.value);
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
        { kind, rtpParameters, appData }: {
          kind: mediasoupTypes.MediaKind;
          rtpParameters: mediasoupTypes.RtpParameters;
          appData: mediasoupTypes.AppData & { source?: ProducerSource };
        },
        callback: (params: { id: string }) => void,
        errback: (error: Error) => void
      ) => {
        // Compat: a produce() call made without an explicit appData.source
        // (should not happen post-slice-01, but defends pre-feature callers)
        // is treated as the mic source.
        const source: ProducerSource = appData?.source ?? 'mic';
        emitAsync<object, AudioProduceResponse>('audio:produce', {
          roomId: currentRoomId.value,
          transportId: producerTransport.value!.id,
          kind,
          rtpParameters,
          source,
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
      disposeRecovery(producerTransport.value);
      producerTransport.value.close();
      producerTransport.value = null;
    }

    if (consumerTransport.value) {
      disposeRecovery(consumerTransport.value);
      consumerTransport.value.close();
      consumerTransport.value = null;
    }

    currentRoomId.value = null;
  }

  /** Intentional teardown must never fire recovery attempts or the toast. */
  function disposeRecovery(transport: Transport): void {
    recoveryHandles.get(transport.id)?.dispose();
    recoveryHandles.delete(transport.id);
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
