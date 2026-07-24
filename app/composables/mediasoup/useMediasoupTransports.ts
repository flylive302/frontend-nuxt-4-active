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

/**
 * Recovery owner for terminal transport failure (audio-pipe-observability 10).
 * When bounded ICE restarts are exhausted the transport is dead but the socket
 * may still be healthy, so none of the socket-level recovery fires. This file
 * stays transport-only: it reports the failure to Sentry and hands off to the
 * registered owner (useRoomLifecycle) which drives the clean rebuild + retry
 * affordance. The fallback toast fires only when no owner is registered, so the
 * user is never left in a silent dead-end.
 */
type TransportExhaustedCallback = () => void;
let _transportExhaustedCallback: TransportExhaustedCallback | null = null;

// ============================================
// ICE diagnostics (audio-pipe-observability 11)
// ============================================
// The `attempts-exhausted` half is unisolable without knowing, per event,
// whether the client was even handed a TURN relay and what ICE candidate types
// it managed to gather. Captured here and attached to the exhaustion Sentry
// event. Pure/module-level — no Vue/socket state needed.

interface IceSchemeSummary {
  /** URL schemes present in the ICE servers handed at transport creation. */
  schemes: string[];
  /** Whether any `turn:`/`turns:` relay was offered (else STUN-only). */
  hadTurn: boolean;
}

interface IceDiag {
  localCandidateTypes: string[];
  remoteCandidateTypes: string[];
  /** e.g. `relay/relay`, `srflx/host`, or null if no pair was ever selected. */
  selectedPair: string | null;
  /** Whether the client gathered any `relay` candidate (TURN actually usable). */
  relayGathered: boolean;
}

/** Minimal shape of the RTCStats rows we read (RTCStatsReport values are `any`). */
interface RtcStatEntry {
  type: string;
  id: string;
  candidateType?: string;
  selected?: boolean;
  nominated?: boolean;
  state?: string;
  localCandidateId?: string;
  remoteCandidateId?: string;
}

/** Was the client handed a TURN relay at transport creation, or STUN-only? */
function summarizeIceSchemes(iceServers: RTCIceServer[] | undefined): IceSchemeSummary {
  const schemes = new Set<string>();
  for (const server of iceServers ?? []) {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    for (const url of urls) {
      const scheme = url.split(':', 1)[0];
      if (scheme) schemes.add(scheme);
    }
  }
  return { schemes: [...schemes], hadTurn: schemes.has('turn') || schemes.has('turns') };
}

/** Snapshot gathered candidate types + selected pair from the transport's PC. */
async function collectIceDiag(transport: Transport): Promise<IceDiag> {
  const empty: IceDiag = {
    localCandidateTypes: [],
    remoteCandidateTypes: [],
    selectedPair: null,
    relayGathered: false,
  };
  try {
    const stats = await transport.getStats();
    const local = new Set<string>();
    const remote = new Set<string>();
    const candidateType = new Map<string, string>();
    stats.forEach((report: RtcStatEntry) => {
      if (report.type === 'local-candidate' && report.candidateType) {
        local.add(report.candidateType);
        candidateType.set(report.id, report.candidateType);
      } else if (report.type === 'remote-candidate' && report.candidateType) {
        remote.add(report.candidateType);
        candidateType.set(report.id, report.candidateType);
      }
    });
    let selectedPair: string | null = null;
    stats.forEach((report: RtcStatEntry) => {
      const isSelected =
        report.type === 'candidate-pair' &&
        (report.selected === true || (report.nominated === true && report.state === 'succeeded'));
      if (isSelected) {
        const l = report.localCandidateId ? candidateType.get(report.localCandidateId) : undefined;
        const r = report.remoteCandidateId ? candidateType.get(report.remoteCandidateId) : undefined;
        selectedPair = `${l ?? '?'}/${r ?? '?'}`;
      }
    });
    return {
      localCandidateTypes: [...local],
      remoteCandidateTypes: [...remote],
      selectedPair,
      relayGathered: local.has('relay'),
    };
  } catch {
    return empty;
  }
}

/**
 * Report a terminal transport failure to Sentry with full ICE diagnostics.
 * MUST run before recovery tears the transport down, so getStats() sees the
 * failed transport's real candidate state.
 */
async function captureTransportExhaustion(
  transport: Transport,
  label: string,
  attempts: number,
  reason: string,
  iceSchemes: IceSchemeSummary,
): Promise<void> {
  const diag = await collectIceDiag(transport);
  const giftStore = useGiftStore();
  Sentry.captureMessage('Audio transport failed after recovery exhausted', {
    level: 'error',
    tags: {
      transport: label,
      reason,
      hadTurn: iceSchemes.hadTurn,
      relayGathered: diag.relayGathered,
    },
    extra: {
      attempts,
      giftQueueDepth: giftStore.playbackQueue.length,
      giftPlaying: giftStore.isPlaying,
      // audio-pipe-observability 11 — ICE context to split the two failure modes.
      iceSchemes: iceSchemes.schemes,
      localCandidateTypes: diag.localCandidateTypes,
      remoteCandidateTypes: diag.remoteCandidateTypes,
      selectedCandidatePair: diag.selectedPair,
      connectionState: transport.connectionState,
    },
  });
}

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

  /**
   * msab-load-stability 10: `failed` is no longer terminal. The recovery
   * engine attempts bounded ICE restarts (server hands fresh ICE creds via
   * `transport:restartIce`); the toast is last-resort, shown only after
   * recovery is exhausted — and the terminal branch reports to Sentry with
   * recovery + gift-load context (this path produced zero events before).
   */
  function attachFailureListener(transport: Transport, label: string, iceSchemes: IceSchemeSummary) {
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
      onExhausted: async ({ attempts, reason }) => {
        // Keep the signal — this is the observability surface the epic was
        // chartered around; capture regardless of who owns recovery. Snapshot
        // ICE diagnostics from the still-open transport BEFORE handing off to
        // recovery (which rebuilds and closes it). Async is safe — the engine
        // fire-and-forgets onExhausted (REACT). Guard: observability must NEVER
        // block the handoff below — a throw here would otherwise skip both the
        // rebuild and the fallback toast, re-creating the silent dead-end
        // ticket 10 kills (this path gates BOTH `reason` halves).
        try {
          await captureTransportExhaustion(transport, label, attempts, reason, iceSchemes);
        } catch {
          // swallow — recovery must not depend on telemetry succeeding
        }
        // Hand recovery to the registered owner (useRoomLifecycle) — it wires
        // the terminal failure into the same rebuild + "Reconnect" affordance
        // the socket-failed path already uses. Robust to both `reason` halves.
        if (_transportExhaustedCallback) {
          _transportExhaustedCallback();
          return;
        }
        // No owner registered (e.g. transport somehow outlived the lifecycle
        // watcher) — never a silent dead-end, but don't blame the user's network.
        toast.add({
          title: 'Audio disconnected',
          description: 'Audio stopped and couldn\'t reconnect. Leave and rejoin the room to restore it.',
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

    const consumerIceSchemes = summarizeIceSchemes(consumerResponse.data.iceServers);

    consumerTransport.value = device.value.createRecvTransport({
      id: consumerResponse.data.id,
      iceParameters: consumerResponse.data.iceParameters,
      iceCandidates: consumerResponse.data.iceCandidates,
      dtlsParameters: consumerResponse.data.dtlsParameters,
      iceServers: consumerResponse.data.iceServers,
    });

    attachFailureListener(consumerTransport.value, 'Consumer transport', consumerIceSchemes);

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

    const producerIceSchemes = summarizeIceSchemes(response.data.iceServers);

    producerTransport.value = device.value.createSendTransport({
      id: response.data.id,
      iceParameters: response.data.iceParameters,
      iceCandidates: response.data.iceCandidates,
      dtlsParameters: response.data.dtlsParameters,
      iceServers: response.data.iceServers,
    });

    attachFailureListener(producerTransport.value, 'Producer transport', producerIceSchemes);

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

  /**
   * Register the recovery owner for terminal transport failure. Mirrors
   * useAudioSocket.onReconnectFailed — useRoomLifecycle registers once and owns
   * the clean rebuild + user-facing retry affordance.
   */
  function onTransportExhausted(cb: TransportExhaustedCallback): void {
    _transportExhaustedCallback = cb;
  }

  // ========================================
  // Return
  // ========================================
  return {
    producerTransport,
    consumerTransport,
    createTransports,
    createProducerTransport,
    onTransportExhausted,
    cleanup,
  };
}
