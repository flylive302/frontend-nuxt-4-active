/**
 * Room Chat Composable
 * 
 * Handles chat message sending in audio rooms.
 * Extracted from useRoomAudio for better separation of concerns.
 */
import type { AudioSocket } from './useAudioSocket';
import { CHAT_MESSAGE_TYPE_TEXT } from '~/constants/room';

export interface UseRoomChatParams {
  /** Socket instance */
  socket: Ref<AudioSocket | null>;
  /** Get current room ID */
  getCurrentRoomId: () => string | null;
}

/**
 * Room chat functionality
 * 
 * @param params - Configuration object with socket and room ID getter
 */
export function useRoomChat({ socket, getCurrentRoomId }: UseRoomChatParams) {
  /**
   * Send a chat message to the current room.
   *
   * GATE — returns `false` (and emits nothing) when there is no socket, the
   * socket is not currently connected, or there is no Room. Callers MUST keep
   * the draft on `false` (room-page-runtime-audit 03): during a mobile
   * transport reconnect the old `void` return let the composer clear the
   * input on a message that was never sent.
   *
   * @param content - Message content
   * @param type - Message type (default: 'text')
   * @returns whether the message was handed to the socket
   */
  function sendChatMessage(content: string, type: string = CHAT_MESSAGE_TYPE_TEXT): boolean {
    const roomId = getCurrentRoomId();

    if (!socket.value || !socket.value.connected || !roomId) {
      return false;
    }

    socket.value.emit('chat:message', {
      roomId,
      content,
      type,
    });
    return true;
  }

  return {
    sendChatMessage,
  };
}
