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
import { useDocumentVisibility, useEventListener } from '@vueuse/core';
import { createLogger } from '~/utils/logger';
import { withTimeout } from '~/utils/with-timeout';
import { ROOM_OP_TIMEOUT_MS } from '~/constants/room';

const log = createLogger('[RoomLifecycle]');

// ============================================
// State
// ============================================

/** Track join in progress to prevent double-joins */
const isJoining = ref(false);

/** Track recovery in progress to prevent overlapping recovery attempts */
const isRecovering = ref(false);

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
  const { joinRoom, leaveRoom, recoverPlayback, probeAudioHealth, connectionStatus } = useRoomAudio();
  const { connect: connectSocket, disconnect: disconnectSocket, onReconnect } = useAudioSocket();
  const { fetchRoomById } = useRoom();
  const toast = useToast();

  // NOTE: there is no auto-resume-on-reconnect. Connection loss is a full leave
  // (the seat is released server-side on disconnect — no retention), so a
  // reconnect re-joins as a listener with no seat to restore.
  async function rebuildRoomAudio(roomId: string): Promise<void> {
    seatsStore.resetSeats();
    disconnectSocket(true);
    await connectSocket();
    await joinRoom(roomId);
  }

  // ========================================
  // Watcher 1: Room Join / Leave / Switch
  // ========================================
  watch(
    () => roomStore.currentRoom,
    async (newRoom, oldRoom) => {
      // Case 1: Room Closed
      if (oldRoom && !newRoom) {
        leaveRoom();
        return;
      }

      // Case 2: Room Changed (switched rooms)
      if (oldRoom && newRoom && oldRoom.id !== newRoom.id) {
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
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast.add({
            title: 'Audio connection failed',
            description: errorMessage || 'Chat and gifting will still work.',
            color: 'warning',
          });
          // Don't close room - let user stay with chat-only mode
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
        // Un-minimized → refresh room metadata from API (may be stale)
        fetchRoomById(roomStore.currentRoom.id);

        // If socket disconnected while minimized, rejoin the room
        if (connectionStatus.value === 'disconnected') {
          if (isJoining.value) return; // Prevent double-join
          isJoining.value = true;
          try {
            await withTimeout(rebuildRoomAudio(String(roomStore.currentRoom.id)), ROOM_OP_TIMEOUT_MS, 'rebuildRoomAudio');
          } catch (err) {
            toast.add({
              title: 'Reconnecting...',
              description: 'Audio may take a moment to restore.',
              color: 'warning',
            });
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
    } catch (error) {
    } finally {
      isJoining.value = false;
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
      isJoining.value = true;
      try {
        await withTimeout(rebuildRoomAudio(String(roomStore.currentRoom.id)), ROOM_OP_TIMEOUT_MS, 'rebuildRoomAudio');
      } catch (err) {
        toast.add({
          title: 'Reconnecting...',
          description: 'Audio may take a moment to restore.',
          color: 'warning',
        });
      } finally {
        isJoining.value = false;
      }
    } finally {
      isRecovering.value = false;
    }
  });

  // ========================================
  // Terminal cleanup: leave the room on real page unload (app / tab close)
  // ========================================
  // `pagehide` fires on genuine document unload (PWA/TWA close, tab close) —
  // NOT on in-app route changes, so swipe-back stays minimized with the socket
  // alive. Proactively emit room:leave so other users see this user removed
  // instantly instead of waiting ~20s for the server socket's pingTimeout to
  // fire the disconnect-driven full leave. Best-effort: if the frame doesn't
  // flush before unload, the pingTimeout path still cleans up.
  useEventListener(window, 'pagehide', () => {
    if (roomStore.currentRoom) {
      leaveRoom(String(roomStore.currentRoom.id));
    }
  });

}
