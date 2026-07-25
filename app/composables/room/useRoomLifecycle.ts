/**
 * Room Lifecycle Composable
 *
 * Manages persistent room lifecycle watchers (join/leave/reconnect).
 * Called once from app.vue — survives across all route changes.
 * Audio composables and Pinia stores are module-level singletons,
 * so they also persist independent of component mounting.
 *
 * Extracted from shell.vue to enable page-route-based room architecture.
 */
import { useDocumentVisibility, useEventListener, useIntervalFn } from '@vueuse/core';
import { createLogger } from '~/utils/logger';
import { withTimeout } from '~/utils/with-timeout';
import { evaluateTransportRebuild } from '~/utils/transport-rebuild-budget';
import { RoomBlockedError } from '~/utils/socket/socketErrorMessages';
import { isReloadIntended } from '~/utils/reload-intent';
import { clearInRoomSnapshot, writeInRoomSnapshot } from '~/utils/reload-telemetry';
import {
  ROOM_OP_TIMEOUT_MS,
  AUDIO_REBUILD_RETRY_BASE_MS,
  AUDIO_REBUILD_RETRY_MAX_MS,
  TRANSPORT_REBUILD_MAX_AUTO,
  TRANSPORT_REBUILD_COOLDOWN_MS,
  ACTIVE_ROOM_HEARTBEAT_MS,
} from '~/constants/room';

const log = createLogger('[RoomLifecycle]');

/** Toast id for the reconnect-failed banner, so it can be dismissed once audio recovers. */
const RECONNECT_FAILED_TOAST_ID = 'audio-reconnect-failed';

// ============================================
// State
// ============================================

/** Track join in progress to prevent double-joins */
const isJoining = ref(false);

/** Track recovery in progress to prevent overlapping recovery attempts */
const isRecovering = ref(false);

/** Pending auto-retry of a failed rebuild (single timer, exponential backoff). */
let rebuildRetryTimer: ReturnType<typeof setTimeout> | null = null;
let rebuildRetryAttempt = 0;

/**
 * Bounded auto-rebuild budget for terminal transport failure
 * (audio-pipe-observability 10). Unlike the socket-failed path, a transport
 * rebuild resolves on transport *creation* while consumer ICE connects lazily,
 * so the `attempts-exhausted` half re-fails and would loop without a gate. Cap
 * to TRANSPORT_REBUILD_MAX_AUTO auto-rebuilds per cooldown window; the window
 * self-resets once exhaustions stop (audio healed).
 */
let transportRebuildAttempt = 0;
let lastTransportExhaustionAt = 0;

// ============================================
// Composable
// ============================================

/**
 * Setup persistent room lifecycle management.
 * Must be called once from a long-lived component (e.g. app.vue).
 */
export function useRoomLifecycle(): void {
  const roomStore = useRoomStore();
  const giftStore = useGiftStore();
  const seatsStore = useRoomSeatsStore();
  const authStore = useAuthStore();
  const { joinRoom, leaveRoom, recoverPlayback, probeAudioHealth, connectionStatus, onTransportExhausted } = useRoomAudio();
  const { connect: connectSocket, disconnect: disconnectSocket, onReconnect, onReconnectFailed } = useAudioSocket();
  const { fetchRoomById } = useRoom();
  const toast = useToast();

  // NOTE (realtime-22): a reconnect re-joins via joinRoom, which now re-produces
  // our mic if MSAB held our seat through the grace window (the snapshot still
  // lists us as an occupant). A speaker who drops briefly returns to the SAME seat
  // as a speaker; only a drop past the grace window (or a listener) rejoins seatless.
  async function rebuildRoomAudio(roomId: string): Promise<void> {
    seatsStore.resetSeats();
    disconnectSocket(true);
    await connectSocket();
    await joinRoom(roomId);
  }

  /**
   * Attempt a single clean rebuild of the room audio (fresh socket + token +
   * rejoin), guarded against overlapping joins. Returns whether it succeeded so
   * callers can decide how to degrade. Used by the reconnect-failed recovery
   * path (auto-attempt + the manual "Reconnect" affordance).
   */
  async function attemptRoomReconnect(roomId: string): Promise<boolean> {
    if (isJoining.value) return false;
    isJoining.value = true;
    try {
      await withTimeout(rebuildRoomAudio(roomId), ROOM_OP_TIMEOUT_MS, 'rebuildRoomAudio');
      // Audio is back — clear any lingering reconnect-failed banner and stop
      // any pending auto-retry.
      toast.remove(RECONNECT_FAILED_TOAST_ID);
      cancelRebuildRetry();
      return true;
    } catch (err) {
      log.warn('Room audio reconnect attempt failed', err);
      return false;
    } finally {
      isJoining.value = false;
    }
  }

  function cancelRebuildRetry(): void {
    if (rebuildRetryTimer) {
      clearTimeout(rebuildRetryTimer);
      rebuildRetryTimer = null;
    }
    rebuildRetryAttempt = 0;
  }

  /**
   * Settle to a defined chat-only state with an actionable "Reconnect" button —
   * the shared floor for both the socket-failed and transport-exhausted paths.
   * The fixed toast id means the two paths can't stack, and a later successful
   * rebuild dismisses it (attemptRoomReconnect / re-join both remove it by id).
   */
  function showReconnectAffordance(): void {
    toast.add({
      id: RECONNECT_FAILED_TOAST_ID,
      title: 'Audio disconnected',
      description: 'Chat and gifting still work. Tap reconnect to restore audio.',
      color: 'warning',
      duration: 0,
      actions: [
        {
          label: 'Reconnect',
          color: 'primary',
          onClick: () => {
            if (roomStore.currentRoom) {
              void attemptRoomReconnect(String(roomStore.currentRoom.id));
            }
          },
        },
      ],
    });
  }

  /**
   * Auto-retry a failed rebuild with exponential backoff until it succeeds or
   * the user leaves/switches rooms. Every failed rebuild path funnels here so
   * a transient failure (network still down on tab resume, MSAB mid-deploy)
   * self-heals instead of dead-ending on a "Reconnecting..." toast.
   */
  function scheduleRebuildRetry(roomId: string): void {
    if (rebuildRetryTimer) return; // one pending retry at a time
    const delay = Math.min(
      AUDIO_REBUILD_RETRY_BASE_MS * 2 ** rebuildRetryAttempt,
      AUDIO_REBUILD_RETRY_MAX_MS,
    );
    rebuildRetryAttempt++;
    log.info(`Scheduling room audio rebuild retry in ${delay}ms (attempt ${rebuildRetryAttempt})`);
    rebuildRetryTimer = setTimeout(async () => {
      rebuildRetryTimer = null;
      if (!roomStore.currentRoom || String(roomStore.currentRoom.id) !== roomId) {
        cancelRebuildRetry();
        return;
      }
      const recovered = await attemptRoomReconnect(roomId);
      if (!recovered) scheduleRebuildRetry(roomId);
    }, delay);
  }

  // ========================================
  // Watcher 1: Room Join / Leave / Switch
  // ========================================
  watch(
    () => roomStore.currentRoom,
    async (newRoom, oldRoom) => {
      // Case 1: Room Closed
      if (oldRoom && !newRoom) {
        cancelRebuildRetry();
        // Pass the explicit ID — currentRoom is already null here, so a bare
        // leaveRoom() can't resolve the room and never emits room:leave,
        // leaving the seat occupied server-side for everyone else.
        leaveRoom(String(oldRoom.id));
        return;
      }

      // Case 2: Room Changed (switched rooms)
      if (oldRoom && newRoom && oldRoom.id !== newRoom.id) {
        cancelRebuildRetry();
        // No await needed (F-72): leaveRoom's mediasoup teardown is synchronous,
        // so the old room is fully torn down before the fall-through joinRoom
        // runs; and the MSAB join handler re-leaves any prior room before
        // joining (F-31, join-room.handler.ts), so server-side ordering is safe.
        leaveRoom(String(oldRoom.id)); // Leave old room first (pass explicit ID since currentRoom is already updated)
        // Fall through to join new room
      }

      // Case 3: New Room Opened
      if (newRoom && (!oldRoom || oldRoom.id !== newRoom.id)) {
        if (isJoining.value) return; // Prevent double-join

        isJoining.value = true;
        try {
          await withTimeout(joinRoom(String(newRoom.id)), ROOM_OP_TIMEOUT_MS, 'joinRoom');
        } catch (error) {
          log.warn('Room join failed', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          if (error instanceof RoomBlockedError) {
            // Blocked users (ADR 0017) may not be in the room at all — this
            // path catches entries that bypassed the HTTP gate (direct URL,
            // back button). Eject instead of degrading to chat-only.
            toast.add({ title: 'Cannot Enter the Room', description: errorMessage, color: 'error' });
            leaveRoom(String(newRoom.id));
            roomStore.leaveRoom();
            const target = roomStore.previousRoute && !roomStore.previousRoute.startsWith('/room/') ? roomStore.previousRoute : '/';
            void navigateTo(target, { replace: true });
          } else {
            toast.add({
              title: 'Audio connection failed',
              description: errorMessage || 'Chat and gifting will still work.',
              color: 'warning',
            });
            // Don't close room - let user stay with chat-only mode
          }
        } finally {
          isJoining.value = false;
        }
      }
    },
    { immediate: true },
  );

  // ========================================
  // Watcher 2: Minimize / Maximize Lifecycle
  // ========================================
  watch(
    () => roomStore.isMinimized,
    async (minimized) => {
      if (minimized) {
        // Minimized → clear gift playback to save resources
        giftStore.clearPlayback();
      } else if (roomStore.currentRoom) {
        // Captured before any await: currentRoom can become null mid-rebuild
        // (user leaves while the timeout races) and the catch below would
        // otherwise crash re-reading it (Sentry JAVASCRIPT-VUE-6R).
        const unminimizedRoomId = String(roomStore.currentRoom.id);
        // Un-minimized → refresh room metadata from API (may be stale)
        fetchRoomById(roomStore.currentRoom.id);

        // If socket disconnected while minimized, rejoin the room
        if (connectionStatus.value === 'disconnected') {
          if (isJoining.value) return; // Prevent double-join
          isJoining.value = true;
          try {
            await withTimeout(rebuildRoomAudio(unminimizedRoomId), ROOM_OP_TIMEOUT_MS, 'rebuildRoomAudio');
          } catch (err) {
            log.warn('Failed to rebuild room audio on un-minimize', err);
            toast.add({
              title: 'Reconnecting...',
              description: 'Audio may take a moment to restore.',
              color: 'warning',
            });
            scheduleRebuildRetry(unminimizedRoomId);
          } finally {
            isJoining.value = false;
          }
        }
      }
    },
  );

  // ========================================
  // Watcher 3: Auto Re-Join After Socket Reconnection
  // ========================================
  // When Socket.IO auto-reconnects (after a temporary disconnect caused by
  // backgrounding, network blip, etc.), the MSAB server has already cleaned
  // up the user's room presence. Re-join to restore seat, owner status, etc.
  onReconnect(async () => {
    if (!roomStore.currentRoom) return;

    const roomId = String(roomStore.currentRoom.id);

    if (isJoining.value) return; // Prevent double-join
    isJoining.value = true;

    try {
      // NOTE: We intentionally do NOT call `seatsStore.resetSeats()` here.
      // The subsequent `joinRoom(roomId)` causes MSAB to send a fresh
      // `room:state` snapshot which overwrites stale seat data via
      // `seatsStore.updateSeat(...)`. Resetting first creates a visible
      // "seat disappears then reappears" flicker for User A on the other end
      // of the room — see §13.8 / F-24 in AUDIT.md.

      // Refresh room metadata from API (may have changed while disconnected)
      fetchRoomById(roomStore.currentRoom.id);

      // Re-join the audio room on MSAB server
      await withTimeout(joinRoom(roomId), ROOM_OP_TIMEOUT_MS, 'joinRoom');
      // If a prior reconnect-failed banner is still up but the socket has since
      // self-healed and rejoined in the background, dismiss it — otherwise the
      // user could tap "Reconnect" and tear down the now-working connection.
      toast.remove(RECONNECT_FAILED_TOAST_ID);
    } catch (error) {
      log.warn('Failed to re-join room after socket reconnect', error);
      scheduleRebuildRetry(roomId);
    } finally {
      isJoining.value = false;
    }
  });

  // ========================================
  // Reconnect Dead-End Recovery (realtime-13 / M8)
  // ========================================
  // Socket.IO exhausted its automatic reconnect attempts. Instead of leaving a
  // dead socket behind a "please refresh the page" toast, drive one clean
  // rebuild (fresh socket + token + rejoin). If that also fails, settle into a
  // defined chat-only state with an actionable "Reconnect" affordance — never a
  // silent dead-end. Outside a room there is nothing to recover, so just clear
  // the dead socket to a clean disconnected state.
  onReconnectFailed(async () => {
    if (!roomStore.currentRoom) {
      disconnectSocket(true);
      return;
    }

    if (isRecovering.value) return;
    isRecovering.value = true;

    try {
      const roomId = String(roomStore.currentRoom.id);
      const recovered = await attemptRoomReconnect(roomId);
      if (recovered) return;

      // Rebuild failed too — degrade cleanly to chat-only with an explicit
      // retry affordance, while backoff keeps retrying in the background.
      disconnectSocket(true);
      scheduleRebuildRetry(roomId);
      showReconnectAffordance();
    } finally {
      isRecovering.value = false;
    }
  });

  // ========================================
  // Transport Recovery Exhausted (audio-pipe-observability 10)
  // ========================================
  // A mediasoup transport died and its bounded ICE restarts were exhausted,
  // while the Socket.IO socket stayed healthy — so none of the socket-level
  // recovery above fires. Wire it into the SAME proven rebuild path, but bound
  // the auto-attempt: the rebuild resolves on transport *creation* (consumer ICE
  // connects lazily), so the `attempts-exhausted` half re-fails and would loop.
  // One auto-rebuild per cooldown window, then settle to the manual "Reconnect"
  // affordance. Robust to both `reason` halves — see ticket 10 §2/§5.
  onTransportExhausted(async () => {
    if (!roomStore.currentRoom) return; // transports only exist inside a room
    if (isRecovering.value) return;
    isRecovering.value = true;

    try {
      const roomId = String(roomStore.currentRoom.id);

      const { autoRebuild, next } = evaluateTransportRebuild(
        { attempt: transportRebuildAttempt, lastAt: lastTransportExhaustionAt },
        Date.now(),
        TRANSPORT_REBUILD_COOLDOWN_MS,
        TRANSPORT_REBUILD_MAX_AUTO,
      );
      transportRebuildAttempt = next.attempt;

      if (autoRebuild) {
        // For `transport-gone` this fully heals (fresh transport:create). For
        // `attempts-exhausted` it may report success yet re-exhaust lazily — the
        // budget then routes the recurrence straight to the affordance.
        const recovered = await attemptRoomReconnect(roomId);
        if (recovered) return;
      }

      // Budget spent this window (or the one auto-rebuild failed): settle to the
      // manual affordance. Deliberately no scheduleRebuildRetry here — the socket
      // is still healthy (chat/gifts work), so background socket churn would hurt
      // more than help; the user reconnects audio on demand, and the visibility /
      // socket-reconnect paths still auto-heal if the socket later drops.
      showReconnectAffordance();
    } finally {
      // Stamp AFTER the rebuild completes so the health window measures the fresh
      // transport's survival time, not the rebuild's own duration.
      lastTransportExhaustionAt = Date.now();
      isRecovering.value = false;
    }
  });

  // ========================================
  // Watcher 4: PWA / Mobile App Resume Recovery
  // ========================================
  // The `visibilitychange` API is the W3C-recommended lifecycle event and fires
  // consistently across all platforms, including mobile PWAs, standalone windows,
  // and browser tabs. This single watcher replaces the old focus-based watcher
  // (which did NOT fire reliably for PWA standalone windows after OS-level
  // process suspension).
  const visibility = useDocumentVisibility();

  watch(visibility, async (state, oldState) => {
    if (state !== 'visible' || oldState !== 'hidden') return;

    if (isRecovering.value) return;
    isRecovering.value = true;

    try {
      if (!roomStore.currentRoom) return;

      // Let the browser settle one frame so paused <audio> elements can self-resume
      // and Socket.IO's heartbeat can confirm liveness before we sample.
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!roomStore.currentRoom || isJoining.value) return;

      const health = await probeAudioHealth();
      if (health === 'healthy') {
        return;
      }

      if (health === 'needs-playback-recovery') {
        const ok = await recoverPlayback();
        if (ok) return;
      }

      // Genuine breakage: socket dead, transport failed, or consumer ended.
      // Re-guard and capture here, not at the watcher's entry: the probe awaits
      // above can span seconds, and the user can leave the room inside them.
      // Re-reading `currentRoom` after an await is what crashed watcher 2
      // (Sentry JAVASCRIPT-VUE-6R); the same read survived here and in the catch
      // below. Capturing keeps the retry pinned to the room we actually probed.
      const rebuildRoomId = roomStore.currentRoom ? String(roomStore.currentRoom.id) : null;
      if (!rebuildRoomId) return;

      isJoining.value = true;
      try {
        await withTimeout(rebuildRoomAudio(rebuildRoomId), ROOM_OP_TIMEOUT_MS, 'rebuildRoomAudio');
      } catch (err) {
        log.warn('Failed to rebuild room audio on visibility restore', err);
        toast.add({
          title: 'Reconnecting...',
          description: 'Audio may take a moment to restore.',
          color: 'warning',
        });
        scheduleRebuildRetry(rebuildRoomId);
      } finally {
        isJoining.value = false;
      }
    } finally {
      isRecovering.value = false;
    }
  });

  // ========================================
  // Active-room marker heartbeat
  // ========================================
  // Keeps the persisted marker fresh while the user is genuinely in a room, so a
  // reload can tell "I was here a second ago" from "I opened this link cold".
  // The marker is only trusted inside ACTIVE_ROOM_MARKER_TTL_MS, so stopping the
  // heartbeat is what makes it expire — no explicit cleanup needed on the paths
  // that end a session abnormally.
  // The same tick also refreshes the telemetry snapshot (REACT). A WebView
  // renderer kill leaves nothing behind in the JS runtime, so this persisted
  // snapshot is the ONLY evidence the next boot has that the user was in a room
  // when the session died — see `utils/reload-telemetry.ts`. It is kept
  // separate from `activeRoom` on purpose: that marker drives rehydration
  // behaviour, this one only observes it, and a measurement must not be able to
  // change what it measures.
  useIntervalFn(() => {
    roomStore.touchActiveRoom();

    const room = roomStore.currentRoom;
    if (!room) {
      // Bounds the false-positive window after a genuine leave to one tick.
      clearInRoomSnapshot();
      return;
    }

    writeInRoomSnapshot({
      roomId: room.id,
      seated: seatsStore.seats.some((seat) => seat.occupantId === authStore.user?.id),
      hidden: visibility.value === 'hidden',
      // `minimizeRoom()` keeps `currentRoom` set, so the user can be "in a room"
      // while browsing elsewhere. Read the real path rather than synthesising
      // `/room/{id}`, or every minimized session lies about where it was.
      minimized: roomStore.isMinimized,
      route: window.location.pathname,
    });
  }, ACTIVE_ROOM_HEARTBEAT_MS);

  // ========================================
  // Terminal cleanup: leave the room on real page unload (app / tab close)
  // ========================================
  // `pagehide` fires on genuine document unload (PWA/TWA close, tab close) —
  // NOT on in-app route changes, so swipe-back stays minimized with the socket
  // alive. Proactively emit room:leave so other users see this user removed
  // instantly instead of waiting ~20s for the server socket's pingTimeout to
  // fire the disconnect-driven full leave. Best-effort: if the frame doesn't
  // flush before unload, the pingTimeout path still cleans up.
  // A deliberate reload is the exception: emitting room:leave there frees the
  // seat instantly, so the user rejoins seatless seconds later. Staying silent
  // lets MSAB's disconnect path RESERVE the seat (SEAT_RETENTION_GRACE_MS) and
  // reclaimSeat hand it back on rejoin — which is the whole point of surviving
  // the reload. Only app-initiated reloads set this flag; a real close still
  // leaves eagerly.
  useEventListener(window, 'pagehide', () => {
    // A deliberate reload must KEEP the telemetry snapshot — it is the evidence
    // the next boot reads to attribute the reload.
    if (isReloadIntended()) {
      if (roomStore.currentRoom) {
        log.info('Reload in progress — skipping room:leave so the seat survives');
      }
      return;
    }

    // Anything else is a genuine close: drop the snapshot so reopening inside
    // its TTL is not misread as a renderer kill. This runs BEFORE the
    // current-room guard on purpose — leaving a room and closing the app a
    // second later is ordinary behaviour, and the heartbeat that would
    // otherwise clear the snapshot only ticks every 5s.
    clearInRoomSnapshot();

    if (!roomStore.currentRoom) return;
    leaveRoom(String(roomStore.currentRoom.id));
  });

}
