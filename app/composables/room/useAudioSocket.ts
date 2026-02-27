import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import type { SocketErrorEvent } from '~/types/room/audio';
import { createLogger } from '~/utils/logger';
import { registerRealtimeEventHandlers, resetRealtimeHandlers } from './useRealtimeEvents';

// ============================================
// Types
// ============================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Typed Socket interface for audio server communication */
export type AudioSocket = Socket;

export interface UseAudioSocketReturn {
  /** The Socket.IO socket instance */
  socket: Ref<AudioSocket | null>;
  /** Current connection status */
  status: Ref<ConnectionStatus>;
  /** Connection error message if any */
  error: Ref<string | null>;
  /** Connect to the audio server. Pass targetUrl for regional routing. */
  connect: (targetUrl?: string) => void;
  /** Disconnect from the audio server */
  disconnect: () => void;
  /** Whether currently connected */
  isConnected: ComputedRef<boolean>;
}

// ============================================
// Shared State (Module-level Singleton)
// ============================================
// CRITICAL: These must be at module level to be shared across all component instances.
// Without this, each component calling useAudioSocket() would get its own isolated socket.

const socket = shallowRef<AudioSocket | null>(null);
const status = ref<ConnectionStatus>('disconnected');
const error = ref<string | null>(null);

/** Tracks the URL the socket is currently connected to */
let _connectedUrl: string | null = null;

// ============================================
// Cached Dependencies (Module-level)
// ============================================
// These are cached on first call to prevent inject() warnings when
// composable is accessed from socket callbacks outside Vue's setup context.

let _config: ReturnType<typeof useRuntimeConfig> | null = null;
let _authStore: ReturnType<typeof useAuthStore> | null = null;
let _toast: ReturnType<typeof useToast> | null = null;

// ============================================
// Composable
// ============================================

/**
 * Composable for managing Socket.IO connection to the audio server.
 * Handles authentication, reconnection, and error handling.
 * 
 * NOTE: This uses module-level state to ensure all components share
 * the same socket connection. This is intentional singleton behavior.
 */
export function useAudioSocket(): UseAudioSocketReturn {
  // ========================================
  // Composables / Injected Dependencies
  // ========================================
  // Initialize on first call only (during Vue setup context)
  if (!_config) _config = useRuntimeConfig();
  if (!_authStore) _authStore = useAuthStore();
  if (!_toast) _toast = useToast();

  // Use cached references
  const config = _config;
  const authStore = _authStore;
  const toast = _toast;

  // ========================================
  // Computed Properties
  // ========================================
  const isConnected = computed(() => status.value === 'connected');

  // ========================================
  // Internal Handlers
  // ========================================

  /** Logger for this module */
  const log = createLogger('[AudioSocket]');

  /** Handle successful connection */
  function handleConnect() {
    status.value = 'connected';
    error.value = null;
    log.debug('Connected:', socket.value?.id);

    // Register app-wide realtime event handlers (balance updates, badges, etc.)
    if (socket.value) {
      registerRealtimeEventHandlers(socket.value);
    }
  }

  /** Handle disconnection */
  function handleDisconnect(reason: string) {
    status.value = 'disconnected';
    log.debug('Disconnected:', reason);

    // If server disconnected us, try to reconnect
    if (reason === 'io server disconnect') {
      socket.value?.connect();
    }
  }

  /** Handle connection errors (including auth failures) */
  function handleConnectError(err: Error) {
    status.value = 'error';
    error.value = err.message;
    log.error('Connection error:', err.message);

    // Handle specific auth errors
    if (err.message === 'Invalid credentials' || err.message === 'Authentication failed') {
      toast.add({
        title: 'Audio connection failed',
        description: 'Please try logging in again.',
        color: 'error',
      });
    } else if (err.message === 'Authentication required') {
      toast.add({
        title: 'Authentication required',
        description: 'Please log in to join the room.',
        color: 'warning',
      });
    }
  }

  /** Handle reconnection attempts */
  function handleReconnectAttempt(attemptNumber: number) {
    status.value = 'connecting';
    log.debug('Reconnecting... attempt:', attemptNumber);
  }

  /** Handle successful reconnection */
  function handleReconnect(attemptNumber: number) {
    status.value = 'connected';
    error.value = null;
    log.debug('Reconnected after', attemptNumber, 'attempts');
  }

  /** Handle server-sent error events */
  function handleError(errorEvent: SocketErrorEvent) {
    log.error('Server error:', errorEvent.message);

    // Show toast for specific errors
    if (errorEvent.message === 'Too many messages') {
      toast.add({
        title: 'Slow down!',
        description: 'You are sending messages too fast.',
        color: 'warning',
      });
    } else if (errorEvent.message === 'Too many gifts, please slow down') {
      toast.add({
        title: 'Slow down!',
        description: 'You are sending gifts too fast.',
        color: 'warning',
      });
    }
  }

  // ========================================
  // Public Methods
  // ========================================

  /**
   * Connect to the audio server with the current auth token.
   *
   * @param targetUrl - Optional regional WebSocket URL. When provided,
   *   the connection will only be skipped if already connected to this
   *   exact URL. When omitted, uses the default config URL and skips
   *   if any connection is active.
   */
  function connect(targetUrl?: string) {
    // Validate prerequisites
    if (!authStore.msabToken) {
      error.value = 'Authentication required';
      status.value = 'error';
      log.error('Cannot connect: No MSAB token');
      return;
    }

    const serverUrl = targetUrl || (config.public.audioServerUrl as string);
    if (!serverUrl) {
      error.value = 'Audio server URL not configured';
      status.value = 'error';
      log.error('Cannot connect: NUXT_PUBLIC_AUDIO_SERVER_URL not set');
      return;
    }

    // URL-aware skip: if targetUrl provided, skip only if connected to SAME URL.
    // If no targetUrl, skip if connected to any URL (existing behavior).
    if (socket.value?.connected) {
      if (targetUrl && _connectedUrl !== targetUrl) {
        // Connected to a different region — force reconnect
        log.debug('Reconnecting to regional URL:', targetUrl);
      } else {
        log.debug('Already connected');
        return;
      }
    }

    // Clean up existing socket if any
    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      // Reset handler flag so global events re-register on the new socket
      resetRealtimeHandlers();
    }

    status.value = 'connecting';
    error.value = null;

    // Create new socket connection
    _connectedUrl = serverUrl;
    socket.value = io(serverUrl, {
      auth: {
        token: authStore.msabToken,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
    });

    // Register event handlers
    socket.value.on('connect', handleConnect);
    socket.value.on('disconnect', handleDisconnect);
    socket.value.on('connect_error', handleConnectError);
    socket.value.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.value.io.on('reconnect', handleReconnect);
    socket.value.on('error', handleError);
  }

  /**
   * Disconnect from the audio server and clean up resources.
   */
  function disconnect() {
    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      socket.value = null;
    }
    status.value = 'disconnected';
    error.value = null;
    _connectedUrl = null;
    // Reset handlers so they can be re-registered on next connect
    resetRealtimeHandlers();
    log.debug('Disconnected by client');
  }


  // NOTE: We intentionally do NOT use onUnmounted here because this is shared state.
  // Disconnecting when one component unmounts would break all other components.
  // The disconnect() method should be called explicitly when leaving a room.

  // ========================================
  // Return
  // ========================================
  return {
    socket,
    status,
    error,
    connect,
    disconnect,
    isConnected,
  };
}
