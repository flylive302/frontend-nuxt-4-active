import { io } from 'socket.io-client';
import type { SocketErrorEvent, AudioSocket } from '~/types/room/audio';
import type { BootstrapResponse } from '~/types/user/bootstrap';
import { createLogger } from '~/utils/logger';
import { registerRealtimeEventHandlers, resetRealtimeHandlers } from './useRealtimeEvents';

// ============================================
// Types
// ============================================

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Re-export for consumers already importing from this file
export type { AudioSocket } from '~/types/room/audio';

/** Callback invoked after Socket.IO auto-reconnects */
type ReconnectCallback = () => void;

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
  /** Register a callback to fire after Socket.IO auto-reconnects */
  onReconnect: (cb: ReconnectCallback) => void;
  /** Recover socket connection after PWA resumes from OS-level suspension */
  recoverFromSuspension: () => Promise<void>;
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

/** Callback to invoke after Socket.IO auto-reconnection */
let _reconnectCallback: ReconnectCallback | null = null;

/** Flag to prevent infinite token refresh loops */
let _isRefreshingToken = false;

/** Timestamp when the page was last hidden (for PWA suspension detection) */
let _hiddenSince: number | null = null;

/** Flag to ensure visibility listener is registered only once */
let _visibilitySetup = false;

// ============================================
// Cached Dependencies (Module-level)
// ============================================
// These are cached on first call to prevent inject() warnings when
// composable is accessed from socket callbacks outside Vue's setup context.

let _config: ReturnType<typeof useRuntimeConfig> | null = null;
let _authStore: ReturnType<typeof useAuthStore> | null = null;
let _toast: ReturnType<typeof useToast> | null = null;
let _apiInstance: ReturnType<typeof useApi> | null = null;

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
  if (!_apiInstance) _apiInstance = useApi();

  // Use cached references
  const config = _config;
  const authStore = _authStore;
  const toast = _toast;

  // ========================================
  // Computed Properties
  // ========================================
  const isConnected = computed(() => status.value === 'connected');

  // ========================================
  // Visibility Tracking (PWA Suspension Detection)
  // ========================================
  // Register once at module level to track when the page is hidden.
  // Needed because PWA standalone windows don't fire window focus/blur events
  // reliably after OS-level process suspension.
  if (!_visibilitySetup && import.meta.client) {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        _hiddenSince = Date.now();
      }
    });
    _visibilitySetup = true;
  }

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

    // Handle specific auth errors — attempt one token refresh before giving up
    if (err.message === 'Invalid credentials' || err.message === 'Authentication failed') {
      attemptTokenRefresh();
    } else if (err.message === 'Authentication required') {
      toast.add({
        title: 'Authentication required',
        description: 'Please log in to join the room.',
        color: 'warning',
      });
    }
  }

  /**
   * Attempt to refresh the MSAB token and retry connection.
   * Updates the existing socket's auth token instead of creating a new socket
   * to avoid conflicts with Socket.IO's built-in auto-reconnection.
   * REACT-safe: failure is logged but never surfaced as a blocking error.
   */
  async function attemptTokenRefresh(): Promise<void> {
    if (_isRefreshingToken) return;
    _isRefreshingToken = true;

    log.debug('Auth rejected — attempting MSAB token refresh');

    try {
      const { refreshMsabToken } = useAuth();
      await refreshMsabToken();

      // Retry connection with fresh token
      if (authStore.msabToken) {
        if (socket.value) {
          // Update auth on EXISTING socket — don't create a new one
          // This avoids a race condition with Socket.IO's auto-reconnect
          (socket.value.auth as Record<string, string>).token = authStore.msabToken;
          socket.value.connect();
          log.debug('Token refreshed, retrying with updated auth on existing socket');
        } else {
          // No socket exists at all — create a fresh one
          log.debug('Token refreshed, creating new connection');
          connect();
        }
      } else {
        log.warn('Token refresh returned empty token');
        toast.add({
          title: 'Audio connection failed',
          description: 'Please try logging in again.',
          color: 'error',
        });
      }
    } catch {
      log.warn('Token refresh failed, manual re-login required');
      toast.add({
        title: 'Audio connection failed',
        description: 'Please try logging in again.',
        color: 'error',
      });
    } finally {
      _isRefreshingToken = false;
    }
  }

  /**
   * Handle reconnection attempts.
   * CRITICAL: Updates the socket's auth token before each retry so Socket.IO's
   * auto-reconnect uses the latest JWT from the store, not the stale one captured
   * at socket construction time. Also proactively refreshes the JWT on the first
   * attempt and every 5th attempt to keep the token fresh.
   */
  async function handleReconnectAttempt(attemptNumber: number) {
    status.value = 'connecting';
    log.debug('Reconnecting... attempt:', attemptNumber);

    // Proactively refresh the MSAB JWT on first attempt and every 5th attempt
    // to avoid hammering the API while still keeping the token fresh
    if (attemptNumber === 1 || attemptNumber % 5 === 0) {
      try {
        const { refreshMsabToken } = useAuth();
        await refreshMsabToken();
        log.debug('Token refreshed before reconnect attempt', attemptNumber);
      } catch {
        log.warn('Token refresh failed before reconnect (will use existing token)');
      }
    }

    // Always update the socket's auth with the latest token from the store
    // This ensures Socket.IO's auto-reconnect sends the freshest token available
    if (socket.value && authStore.msabToken) {
      (socket.value.auth as Record<string, string>).token = authStore.msabToken;
    }
  }

  /** Handle successful reconnection */
  function handleReconnect(attemptNumber: number) {
    status.value = 'connected';
    error.value = null;
    log.debug('Reconnected after', attemptNumber, 'attempts');

    // Re-register app-wide realtime event handlers on new socket session
    if (socket.value) {
      registerRealtimeEventHandlers(socket.value);
    }

    // Refresh balance from API to catch events missed during disconnect
    refreshBalance();

    // Notify lifecycle layer so it can re-join the room
    if (_reconnectCallback) {
      _reconnectCallback();
    }
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
    } else if (status.value === 'connecting') {
      // Already in the process of connecting — skip unless targeting a different URL
      if (!targetUrl || _connectedUrl === serverUrl) {
        log.debug('Connection already in progress, skipping');
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
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
      transports: ['websocket'], // Audio server is WebSocket-only — no polling fallback
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
    _reconnectCallback = null;
    // Reset handlers so they can be re-registered on next connect
    resetRealtimeHandlers();
    log.debug('Disconnected by client');
  }

  /**
   * Refresh balance from API after reconnection.
   * Non-blocking — failure is logged but does not affect socket state.
   */
  async function refreshBalance(): Promise<void> {
    try {
      const response = await _apiInstance!.api<BootstrapResponse>('/bootstrap');
      if (response?.user) {
        const userStore = useUserStore();
        userStore.updateBalance({
          coins: response.user.coins,
          diamonds: response.user.diamonds,
          wealth_xp: response.user.wealth_xp,
          charm_xp: response.user.charm_xp,
        });
      }
    } catch (err) {
      log.debug('Balance refresh after reconnect failed (non-blocking)', err);
    }
  }


  // NOTE: We intentionally do NOT use onUnmounted here because this is shared state.
  // Disconnecting when one component unmounts would break all other components.
  // The disconnect() method should be called explicitly when leaving a room.

  // ========================================
  // PWA Suspension Recovery
  // ========================================

  /**
   * Recover the socket connection after the PWA resumes from OS-level suspension.
   *
   * GATE:    Skip if hidden < 5s (let Socket.IO handle naturally) or no socket exists.
   * EXECUTE: For long suspensions (>1h), refresh MSAB token proactively.
   *          For shorter ones, just update socket auth with stored token.
   *          Force engine transport close to trigger Socket.IO's reconnect cycle.
   * REACT:   Logging only — room rejoin is handled by Watcher 4 via _reconnectCallback.
   */
  async function recoverFromSuspension(): Promise<void> {
    const hiddenMs = _hiddenSince ? Date.now() - _hiddenSince : 0;
    _hiddenSince = null;

    // Short hide — let Socket.IO handle naturally
    if (hiddenMs < 5_000) {
      log.debug('Short suspension (', Math.round(hiddenMs / 1000), 's) — skipping recovery');
      return;
    }

    log.debug('Recovering from', Math.round(hiddenMs / 1000), 's suspension');

    // Only proactively refresh token for long suspensions (>1h)
    // where the 30-day JWT might be stale with outdated user data.
    // For shorter suspensions, the stored token is fine.
    if (hiddenMs > 3_600_000) {
      const { refreshMsabToken } = useAuth();
      const ok = await refreshMsabToken();
      if (ok) {
        log.debug('Token refreshed during long suspension recovery');
      }
      // Even if refresh fails, continue — stored 30-day token likely still valid
    }

    // Update socket auth with the latest token from the store
    if (socket.value && authStore.msabToken) {
      (socket.value.auth as Record<string, string>).token = authStore.msabToken;
    }

    // Force Socket.IO to detect dead connection and auto-reconnect.
    // Closing the engine transport triggers the full reconnect cycle:
    //   disconnect → reconnect_attempt (handleReconnectAttempt) → reconnect (handleReconnect)
    // This reuses all existing infrastructure: token refresh, room rejoin via _reconnectCallback.
    if (socket.value?.connected) {
      log.debug('Forcing engine close to trigger reconnect cycle');
      socket.value.io.engine.close();
    }
    // If already disconnected: auto-reconnect is running and will use the fresh token we just set
  }

  // ========================================
  // Return
  // ========================================
  /**
   * Register a callback to fire after Socket.IO auto-reconnects.
   * Used by useRoomLifecycle to re-join the room after a temporary disconnect.
   */
  function onReconnect(cb: ReconnectCallback): void {
    _reconnectCallback = cb;
  }

  return {
    socket,
    status,
    error,
    connect,
    disconnect,
    isConnected,
    onReconnect,
    recoverFromSuspension,
  };
}
