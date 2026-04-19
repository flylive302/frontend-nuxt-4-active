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
import { useDocumentVisibility } from '@vueuse/core';
import { createLogger } from '~/utils/logger';

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
  const authStore = useAuthStore();
  const giftStore = useGiftStore();
  const { joinRoom, leaveRoom, connectionStatus } = useRoomAudio();
  const { connect: connectSocket, disconnect: disconnectSocket, isConnected, onReconnect, recoverFromSuspension } = useAudioSocket();
  const { refreshMsabToken } = useAuth();
  const { fetchRoomById } = useRoom();
  const toast = useToast();

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
        leaveRoom(String(oldRoom.id)); // Leave old room first (pass explicit ID since currentRoom is already updated)
        // Fall through to join new room
      }

      // Case 3: New Room Opened
      if (newRoom && (!oldRoom || oldRoom.id !== newRoom.id)) {
        if (isJoining.value) return; // Prevent double-join

        isJoining.value = true;
        try {
          await joinRoom(String(newRoom.id));
        } catch (error) {
          log.error('Failed to join audio:', error);
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
            disconnectSocket();
            await connectSocket();
            await joinRoom(String(roomStore.currentRoom.id));
          } catch (err) {
            log.warn('Reconnect after un-minimize failed:', err);
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
    log.debug('Socket reconnected — re-joining room:', roomId);

    if (isJoining.value) return; // Prevent double-join
    isJoining.value = true;

    try {
      // Refresh room metadata from API (may have changed while disconnected)
      fetchRoomById(roomStore.currentRoom.id);

      // Re-join the audio room on MSAB server
      await joinRoom(roomId);
      log.debug('Successfully re-joined room after reconnect');
    } catch (error) {
      log.error('Failed to re-join room after reconnect:', error);
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

    // Prevent overlapping recovery attempts from rapid visibility changes
    if (isRecovering.value) return;
    isRecovering.value = true;

    try {
      // Socket-level: refresh token + force reconnect if stale connection detected
      await recoverFromSuspension();

      // If no room is open or socket already reconnected, nothing more to do.
      // Watcher 3 (onReconnect) handles room rejoin when auto-reconnect succeeds.
      if (!roomStore.currentRoom || isConnected.value) return;

      // Give Socket.IO auto-reconnect a moment to complete
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Re-check after wait — conditions may have changed
      if (!roomStore.currentRoom || isConnected.value || isJoining.value) return;

      // Fallback: auto-reconnect hasn't succeeded — trigger manual reconnect + rejoin
      isJoining.value = true;
      try {
        disconnectSocket();
        await connectSocket();
        await joinRoom(String(roomStore.currentRoom.id));
      } catch (err) {
        log.warn('Reconnect after PWA resume failed:', err);
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
  // Watcher 5: Proactive JWT Refresh Timer
  // ========================================
  // Refresh the MSAB JWT every 2 hours while connected to keep
  // embedded user data (name, avatar, balance) fresh.
  // With a 30-day token lifetime, this gives ~360 refresh
  // opportunities before expiry. Non-blocking — failure is logged
  // but does not interrupt any active session.
  const PROACTIVE_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

  const proactiveRefreshTimer = setInterval(async () => {
    if (!authStore.msabToken || !isConnected.value) return;

    try {
      await refreshMsabToken();
      log.debug('Proactive MSAB token refresh complete');
    } catch {
      log.warn('Proactive token refresh failed (non-blocking)');
    }
  }, PROACTIVE_REFRESH_INTERVAL_MS);

  // Clean up timer if the composable host component is unmounted
  onUnmounted(() => clearInterval(proactiveRefreshTimer));
}
