/**
 * Socket Utilities
 *
 * Shared utilities for Socket.IO communication.
 * Extracted to avoid duplication across composables.
 */
import type { Ref } from 'vue';
import type { AudioSocket } from '~/types/room/audio';
import { SOCKET_TIMEOUT_MS } from '~/constants/room';

/**
 * Creates a promise-based emit function for socket communication.
 * Wraps socket.emit with timeout and error handling.
 *
 * @param socket - Ref to the socket instance
 * @returns A function that emits events and returns a promise
 *
 * @example
 * const emitAsync = createEmitAsync(socket);
 * const response = await emitAsync<Payload, Response>('event:name', { data: 'value' });
 */
export function createEmitAsync(socket: Ref<AudioSocket | null>) {
  return function emitAsync<TPayload, TResponse>(
    event: string,
    payload: TPayload,
    timeoutMs: number = SOCKET_TIMEOUT_MS
  ): Promise<TResponse> {
    return new Promise((resolve, reject) => {
      if (!socket.value) {
        reject(new Error('Socket not connected'));
        return;
      }

      let settled = false;

      const cleanup = () => {
        clearTimeout(timeout);
        socket.value?.off('disconnect', disconnectHandler);
      };

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Socket event '${event}' timed out`));
      }, timeoutMs);

      // Fail fast on disconnect instead of waiting full timeout
      const disconnectHandler = () => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(`Socket disconnected during '${event}'`));
      };
      socket.value.once('disconnect', disconnectHandler);

      socket.value.emit(event, payload, (response: TResponse) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(response);
      });
    });
  };
}

