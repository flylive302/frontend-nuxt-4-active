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
   * @param content - Message content
   * @param type - Message type (default: 'text')
   */
  function sendChatMessage(content: string, type: string = CHAT_MESSAGE_TYPE_TEXT): void {
    const roomId = getCurrentRoomId();
    
    if (!socket.value || !roomId) {
      return;
    }

    socket.value.emit('chat:message', {
      roomId,
      content,
      type,
    });
  }

  return {
    sendChatMessage,
  };
}
