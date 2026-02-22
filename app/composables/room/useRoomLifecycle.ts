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
  const { joinRoom, leaveRoom, connectionStatus } = useRoomAudio();
  const { connect: connectSocket } = useAudioSocket();
  const toast = useToast();

  // ========================================
  // Eager Socket Pre-Connection
  // ========================================
  // Pre-connect the WebSocket immediately so the handshake completes
  // before the user clicks a room. This eliminates ~500ms+ of delay
  // on first room entry (TLS + WebSocket upgrade).
  connectSocket();
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
        leaveRoom(); // Leave old room first
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
  // Watcher 2: Reconnection After Tab Focus
  // ========================================
  const isFocused = useWindowFocus();
  watch(isFocused, async (focused) => {
    if (focused && roomStore.currentRoom && connectionStatus.value === 'disconnected') {
      // Tab regained focus and we're in a room but disconnected
      try {
        await joinRoom(String(roomStore.currentRoom.id));
      } catch {
        // Silent fail - user is back, will see error if needed
      }
    }
  });
}
