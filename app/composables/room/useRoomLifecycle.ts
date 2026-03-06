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
import { useWindowFocus } from '@vueuse/core';
import { createLogger } from '~/utils/logger';

const log = createLogger('[RoomLifecycle]');

// ============================================
// State
// ============================================

/** Track join in progress to prevent double-joins */
const isJoining = ref(false);

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
  const { connect: connectSocket, disconnect: disconnectSocket, isConnected, onReconnect } = useAudioSocket();
  const { refreshMsabToken } = useAuth();
  const { fetchRoomById } = useRoom();
  const toast = useToast();

  // ========================================
  // Eager Socket Pre-Connection
  // ========================================
  // Pre-connect the WebSocket so the handshake completes before the user
  // opens a room. Refresh the MSAB JWT first so the socket connects with
  // the latest user profile data from the database (avatar, name, etc.).
  if (authStore.msabToken) {
    refreshMsabToken().then(() => connectSocket());
  }

  // Watch for token to become available and connect when ready
  const stopTokenWatch = watch(
    () => authStore.msabToken,
    (newToken) => {
      if (newToken && !isConnected.value) {
        connectSocket();
        stopTokenWatch();
      }
    },
  );
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
          try {
            await refreshMsabToken();
            disconnectSocket();
            connectSocket();
            await joinRoom(String(roomStore.currentRoom.id));
          } catch {
            // Silent fail
          }
        }
      }
    },
  );

  // ========================================
  // Watcher 3: Reconnection After Tab Focus
  // ========================================
  const isFocused = useWindowFocus();
  watch(isFocused, async (focused) => {
    if (focused && roomStore.currentRoom && connectionStatus.value === 'disconnected') {
      // Tab regained focus — refresh JWT + reconnect socket for fresh user data
      try {
        await refreshMsabToken();
        disconnectSocket();
        connectSocket();
        await joinRoom(String(roomStore.currentRoom.id));
      } catch {
        // Silent fail - user is back, will see error if needed
      }
    }
  });

  // ========================================
  // Watcher 4: Auto Re-Join After Socket Reconnection
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
}
