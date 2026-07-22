/**
 * Transport recovery engine (msab-load-stability 10).
 *
 * Distinguishes `disconnected` (transient — grace period, then ICE restart)
 * from `failed` (immediate ICE restart), retrying with bounded backoff before
 * declaring the outage terminal. Callers supply the transport-facing and
 * user-facing effects via deps, so the state machine is unit-testable with a
 * fake transport (no Vue reactivity, no sockets in here).
 *
 * GATE: state transitions + attempt bounds. EXECUTE: server restartIce round
 * trip + transport.restartIce. REACT: onRecovered / onExhausted callbacks
 * (toast + Sentry live in the caller, keeping this engine pure of UI).
 */
import type { types as mediasoupTypes } from 'mediasoup-client';
import {
  TRANSPORT_DISCONNECTED_GRACE_MS,
  TRANSPORT_RECOVERY_MAX_ATTEMPTS,
  TRANSPORT_RECOVERY_BACKOFF_MS,
} from '~/constants/room';

// ============================================
// Types
// ============================================

/** The slice of a mediasoup-client Transport the engine touches (fakeable). */
export interface RecoverableTransport {
  closed: boolean;
  connectionState: mediasoupTypes.ConnectionState;
  restartIce: (params: { iceParameters: mediasoupTypes.IceParameters }) => Promise<void>;
  on: (event: 'connectionstatechange', cb: (state: mediasoupTypes.ConnectionState) => void) => void;
}

/** Why recovery went terminal: retries ran out, or the server no longer has
 * the transport (prod-bugs 03 — further restarts are futile by construction). */
export type RecoveryExhaustedReason = 'attempts-exhausted' | 'transport-gone';

export interface TransportRecoveryDeps {
  /**
   * Ask MSAB for fresh ICE parameters; null = server refused/errored (counts
   * as a failed attempt); 'transport-gone' = server says the transport no
   * longer exists (typed refusal) — recovery goes terminal immediately.
   */
  requestIceRestart: () => Promise<mediasoupTypes.IceParameters | null | 'transport-gone'>;
  /** Silent-recovery hook (logging/metrics only — never a toast). */
  onRecovered: (ctx: { attempts: number }) => void;
  /** Terminal: bounded retries exhausted. The ONLY place a failure toast may come from. */
  onExhausted: (ctx: { attempts: number; reason: RecoveryExhaustedReason }) => void;
  log: (msg: string, data?: Record<string, unknown>) => void;
  disconnectedGraceMs?: number;
  maxAttempts?: number;
  backoffMs?: readonly number[];
}

export interface TransportRecoveryHandle {
  dispose: () => void;
}

// ============================================
// Engine
// ============================================

export function attachTransportRecovery(
  transport: RecoverableTransport,
  deps: TransportRecoveryDeps,
): TransportRecoveryHandle {
  const graceMs = deps.disconnectedGraceMs ?? TRANSPORT_DISCONNECTED_GRACE_MS;
  const maxAttempts = deps.maxAttempts ?? TRANSPORT_RECOVERY_MAX_ATTEMPTS;
  const backoffMs = deps.backoffMs ?? TRANSPORT_RECOVERY_BACKOFF_MS;

  let attempts = 0;
  let recovering = false;
  let exhausted = false;
  let disposed = false;
  let pendingTimer: ReturnType<typeof setTimeout> | null = null;

  transport.on('connectionstatechange', handleState);

  function handleState(state: mediasoupTypes.ConnectionState): void {
    if (disposed || transport.closed) return;

    if (state === 'connected') {
      // GATE: only an outage that consumed restart attempts counts as
      // "recovered" (the flag alone is racy — restartIce resolves before the
      // resulting `connected` event arrives).
      clearPending();
      const usedAttempts = attempts;
      resetOutage();
      if (usedAttempts > 0) deps.onRecovered({ attempts: usedAttempts });
      return;
    }

    if (state === 'disconnected') {
      // Transient by definition — give ICE its own chance first, then restart.
      if (pendingTimer || recovering || exhausted) return;
      deps.log('transport disconnected — recovery grace started', { graceMs });
      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        // Re-check: the browser may have re-established on its own.
        if (transport.connectionState === 'disconnected' || transport.connectionState === 'failed') {
          void attemptRestart();
        }
      }, graceMs);
      return;
    }

    if (state === 'failed') {
      // Terminal at the ICE layer — only a restart can revive it.
      clearPending();
      if (exhausted) return;
      void attemptRestart();
    }
  }

  async function attemptRestart(): Promise<void> {
    if (disposed || transport.closed || exhausted || recovering) return;

    if (attempts >= maxAttempts) {
      exhausted = true;
      deps.log('transport recovery exhausted', { attempts });
      deps.onExhausted({ attempts, reason: 'attempts-exhausted' });
      return;
    }

    recovering = true;
    attempts++;
    const backoff = backoffMs[Math.min(attempts - 1, backoffMs.length - 1)] ?? 0;
    deps.log('transport recovery attempt scheduled', { attempt: attempts, backoff });

    await delay(backoff);
    if (disposed || transport.closed) return;
    // The browser may have re-established on its own during the backoff (the
    // `connected` handler already reset the outage) — a stale restart against
    // a healthy transport could knock it back into `disconnected`.
    if (transport.connectionState !== 'disconnected' && transport.connectionState !== 'failed') {
      recovering = false;
      return;
    }

    try {
      // EXECUTE: fresh ICE creds from MSAB, then client-side restart
      // (re-gathers candidates against the same transport/producers).
      const iceParameters = await deps.requestIceRestart();
      if (iceParameters === 'transport-gone') {
        // Server no longer has this transport — retrying restartIce can never
        // succeed. Go terminal now instead of burning remaining attempts.
        exhausted = true;
        recovering = false;
        deps.log('transport gone server-side — recovery terminal', { attempts });
        deps.onExhausted({ attempts, reason: 'transport-gone' });
        return;
      }
      if (!iceParameters) throw new Error('server declined ICE restart');
      await transport.restartIce({ iceParameters });
      // Success/failure now arrives via connectionstatechange: `connected`
      // finishes the recovery, another `failed` triggers the next attempt.
      recovering = false;
      if (transport.connectionState === 'failed') void attemptRestart();
    } catch (err) {
      deps.log('transport recovery attempt failed', { attempt: attempts, err: String(err) });
      recovering = false;
      void attemptRestart();
    }
  }

  function resetOutage(): void {
    attempts = 0;
    recovering = false;
    exhausted = false;
  }

  function clearPending(): void {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = null;
    }
  }

  function dispose(): void {
    disposed = true;
    clearPending();
  }

  return { dispose };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
