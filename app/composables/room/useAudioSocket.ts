import { io } from 'socket.io-client';
import type { SocketErrorEvent, AudioSocket } from '~/types/room/audio';
import { createLogger } from '~/utils/logger';
import { useRealtimeEvents, resetRealtimeHandlers } from './useRealtimeEvents';

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
  connect: (targetUrl?: string) => Promise<void>;
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
let _userStore: ReturnType<typeof useUserStore> | null = null;
let _toast: ReturnType<typeof useToast> | null = null;
let _apiInstance: ReturnType<typeof useApi> | null = null;
let _authActions: ReturnType<typeof useAuthActions> | null = null;

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
  if (!_userStore) _userStore = useUserStore();
  if (!_toast) _toast = useToast();
  if (!_apiInstance) _apiInstance = useApi();
  if (!_authActions) _authActions = useAuthActions();

  // Initialize realtime events composable
  const { registerRealtimeEventHandlers } = useRealtimeEvents();

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

  /** Handle a successful connection */
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

    // With a 30-day stateless JWT, auth rejection means the user is
    // blocked/revoked — not that the token expired. Show a clear message
    // instead of attempting a refresh that races with reconnection logic.
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

  /**
   * Handle reconnection attempts.
   * The dynamic auth callback already ensures the socket uses the latest
   * token from the store — no proactive refresh is needed here.
   */
  function handleReconnectAttempt(attemptNumber: number) {
    status.value = 'connecting';
    log.debug('Reconnecting... attempt:', attemptNumber);
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
  async function connect(targetUrl?: string) {
    // Auto-refresh MSAB token if not available
    if (!authStore.msabToken) {
      log.debug('No MSAB token — attempting refresh before connect');
      status.value = 'error';
      await _authActions!.refreshMsabToken();
    }

    const serverUrl = targetUrl || (config.public.audioServerUrl as string);
    if (!serverUrl) {
      error.value = 'Audio server URL not configured';
      status.value = 'error';
      log.error('Cannot connect: NUXT_PUBLIC_AUDIO_SERVER_URL not set');
      return;
    }

    // URL-aware skip: if targetUrl provided, skip only if connected to the SAME URL.
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
      auth: (cb) => {
        cb({ token: authStore.msabToken });
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      timeout: 10000,
      transports: ['websocket'], // WS-only: polling requires sticky sessions, but NLB with GA can't preserve client IPs so stickiness breaks across the 2 MSAB instances
    });

    // Register event handlers
    socket.value.on('connect', handleConnect);
    socket.value.on('disconnect', handleDisconnect);
    socket.value.on('connect_error', handleConnectError);
    socket.value.io.on('reconnect_attempt', handleReconnectAttempt);
    socket.value.io.on('reconnect', handleReconnect);
    socket.value.on('error', handleError);

    // ── Auth: Force-Disconnect Listener ──────────────────────────────
    // Fired by MSAB when the user is blocked/suspended by an admin.
    // The infrastructure layer just forwards the payload — REACT logic
    // (suspension state, socket teardown, navigation) lives in
    // useAuthLifecycle so this file stays infrastructure-only.
    const { handleForceDisconnect } = useAuthLifecycle();
    socket.value.on('auth:force_disconnect', (payload: {
      reason: string;
      blocked_until?: string | null;
      blocked_reason?: string | null;
    }) => {
      void handleForceDisconnect(payload);
    });

    // ── Profile Update → Non-blocking MSAB token refresh ─────────────
    // When the user's profile changes server-side, the MSAB JWT may carry
    // stale user data. Proactively refresh it so room participants see
    // updated profile info without waiting for the next reconnect cycle.
    socket.value.on('user.profile.updated', () => {
      _authActions!.refreshMsabToken().catch(() => {
        log.debug('Post-profile-update MSAB refresh failed (non-blocking)');
      });
    });
  }

  /**
   * Disconnect from the audio server and clean up resources.
   * Clears all module-level singleton state so the next login starts fresh.
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
    _hiddenSince = null;
    // Reset handlers so they can be re-registered on next connection
    resetRealtimeHandlers();
    log.debug('Disconnected by client');
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
   * EXECUTE: Force engine transport close to trigger Socket.IO's reconnect cycle.
   *          The dynamic auth callback ensures the latest token from the store is used.
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

    // Force Socket.IO to detect dead connection and auto-reconnect.
    // Closing the engine transport triggers the full reconnect cycle:
    //   disconnect → reconnect_attempt (handleReconnectAttempt) → reconnect (handleReconnect)
    // This reuses all existing infrastructure: token refresh, room rejoin via _reconnectCallback.
    if (socket.value?.connected) {
      log.debug('Forcing engine close to trigger reconnect cycle');
      socket.value.io.engine.close();
    } else if (socket.value) {
      log.debug('Forcing immediate reconnection attempt');
      socket.value.connect();
    }
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
