import type { SocketErrorEvent, AudioSocket } from '~/types/room/audio';
import { createLogger } from '~/utils/logger';
import { useRealtimeEvents, resetRealtimeHandlers } from './useRealtimeEvents';

// Lazy-loaded: socket.io-client must NOT be statically imported because
// it uses the `debug` package which binds to the console —
// this crashes in Cloudflare Workers (workerd) runtime during SSR.
let _io: typeof import('socket.io-client')['io'] | null = null;
async function getIo() {
  if (!_io) {
    const mod = await import('socket.io-client');
    _io = mod.io;
  }
  return _io;
}

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
  disconnect: (preserveReconnectCallback?: boolean) => void;
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

/**
 * Direct ref export — use this when calling useAudioSocket() would create a circular
 * dependency (e.g. from composables that are themselves called during useAudioSocket init).
 * It is the same singleton ref returned by useAudioSocket().socket.
 */
export const audioSocketRef = socket;
const status = ref<ConnectionStatus>('disconnected');
const error = ref<string | null>(null);

/** Tracks the URL the socket is currently connected to */
let _connectedUrl: string | null = null;

/** Callback to invoke after Socket.IO auto-reconnection */
let _reconnectCallback: ReconnectCallback | null = null;

/** Timestamp when the page was last hidden (for PWA suspension detection) */
let _hiddenSince: number | null = null;

/** Flag to ensure visibility listener is registered only once */
let _visibilitySetup = false

/** Prevents a stale/null token from causing immediate logout — one refresh attempt before giving up */
let _authRetryInFlight = false;

// ============================================
// Cached Dependencies (Module-level)
// ============================================
// These are cached on first call to prevent inject() warnings when
// composable is accessed from socket callbacks outside Vue's setup context.

let _config: ReturnType<typeof useRuntimeConfig> | null = null;
let _authStore: ReturnType<typeof useAuthStore> | null = null;
let _toast: ReturnType<typeof useToast> | null = null;
let _apiInstance: ReturnType<typeof useApi> | null = null;
let _authActions: ReturnType<typeof useAuthActions> | null = null;
let _realtimeEvents: ReturnType<typeof useRealtimeEvents> | null = null;

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
  if (!_authActions) _authActions = useAuthActions();
  if (!_realtimeEvents) _realtimeEvents = useRealtimeEvents();

  const { registerRealtimeEventHandlers } = _realtimeEvents;

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
    _authRetryInFlight = false;

    // Register app-wide realtime event handlers (balance updates, badges, etc.)
    if (socket.value) {
      registerRealtimeEventHandlers(socket.value);
    }
  }

  /** Handle disconnection */
  function handleDisconnect(reason: string) {
    status.value = 'disconnected';

    // If server disconnected us, try to reconnect
    if (reason === 'io server disconnect') {
      socket.value?.connect();
    }
  }

  /**
   * Handle connection errors (including auth failures).
   *
   * CRITICAL DESIGN RULE: This handler must NEVER call logout().
   * Audio socket auth failures degrade to chat-only mode (handled by
   * useRoomLifecycle's try/catch around joinRoom). Real session expiry
   * is handled by the 401 API interceptor in useApi.ts, and admin blocks
   * by the auth:force_disconnect event in useAuthLifecycle.ts.
   *
   * The retry logic here is ONLY for recovering stale/null MSAB tokens
   * when the Sanctum session is still valid. If the retry fails, the
   * socket stays in 'error' state — the user keeps their session.
   */
  function handleConnectError(err: Error) {
    status.value = 'error';
    error.value = err.message;

    const authFailed =
      err.message === 'Invalid credentials' ||
      err.message === 'Authentication failed' ||
      err.message === 'Authentication required';

    if (!authFailed) {
      // Network / DNS / TLS / server-unreachable. Socket.IO keeps retrying
      // automatically and the connection degrades to chat-only. We deliberately
      // do NOT toast here: a user going offline (or a brief blip) shouldn't get
      // an error popup on every retry. The connection `status` reflects the
      // state for any UI that wants a subtle indicator.
      return;
    }

    if (_authRetryInFlight) {
      // Second auth failure — token refresh didn't help.
      // Leave socket disconnected; user stays in chat-only mode.
      _authRetryInFlight = false;
      socket.value?.disconnect();
      toast.add({
        title: 'Audio connection failed',
        description: 'Chat and gifting will still work.',
        color: 'warning',
      });
      return;
    }

    // First auth failure — the MSAB token may be stale or null at the time the
    // socket was created. Stop auto-reconnection (which would reuse the same bad
    // token), refresh once, then manually reconnect with the fresh token.
    _authRetryInFlight = true;
    socket.value?.disconnect();

    _authActions!.refreshMsabToken().then((success) => {
      if (success && _authStore!.msabToken) {
        socket.value?.connect();
      } else {
        // Refresh failed — leave socket disconnected, user keeps their session.
        _authRetryInFlight = false;
        socket.value?.disconnect();
        toast.add({
          title: 'Audio connection failed',
          description: 'Chat and gifting will still work.',
          color: 'warning',
        });
      }
    }).catch(() => {
      _authRetryInFlight = false;
      socket.value?.disconnect();
      toast.add({
        title: 'Audio connection failed',
        description: 'Chat and gifting will still work.',
        color: 'warning',
      });
    });
  }

  /** All reconnection attempts exhausted — surface a clear error instead of failing silently. */
  function handleReconnectFailed() {
    status.value = 'error';
    error.value = 'Unable to reconnect to audio server';
    toast.add({
      title: 'Connection lost',
      description: 'Could not reach the audio server. Please refresh the page.',
      color: 'error',
    });
  }

  /**
   * Handle reconnection attempts.
   * The dynamic auth callback already ensures the socket uses the latest
   * token from the store — no proactive refresh is needed here.
   */
  function handleReconnectAttempt(attemptNumber: number) {
    status.value = 'connecting';
  }

  /** Handle successful reconnection */
  function handleReconnect(attemptNumber: number) {
    status.value = 'connected';
    error.value = null;
    const recovered = socket.value?.recovered === true;

    // Re-register app-wide realtime event handlers on new socket session
    if (socket.value) {
      registerRealtimeEventHandlers(socket.value);
    }

    // If the server resumed the previous session (connectionStateRecovery),
    // we're still in the room from its perspective — skip the rejoin cycle
    // to avoid unnecessary state churn. Lifecycle callback is only for full
    // session resets where presence on the server has been cleaned up.
    if (recovered) return;

    if (_reconnectCallback) {
      _reconnectCallback();
    }
  }

  /** Handle server-sent error events */
  function handleError(errorEvent: SocketErrorEvent) {

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
      status.value = 'error';
      const refreshOk = await _authActions!.refreshMsabToken();
      if (!refreshOk || !authStore.msabToken) {
        error.value = 'No audio token available';
        return;
      }
    }


    const serverUrl = targetUrl || (config.public.audioServerUrl as string);
    if (!serverUrl) {
      error.value = 'Audio server URL not configured';
      status.value = 'error';
      return;
    }

    // URL-aware skip: if targetUrl provided, skip only if connected to the SAME URL.
    // If no targetUrl, skip if connected to any URL (existing behavior).
    if (socket.value?.connected) {
      if (targetUrl && _connectedUrl !== targetUrl) {
        // Connected to a different region — force reconnect
      } else {
        return;
      }
    } else if (status.value === 'connecting') {
      // Already in the process of connecting — skip unless targeting a different URL
      if (!targetUrl || _connectedUrl === serverUrl) {
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
    const io = await getIo();
    socket.value = io(serverUrl, {
      auth: (cb: (data: { token: string | null }) => void) => {
        cb({ token: authStore.msabToken });
      },
      reconnection: true,
      reconnectionAttempts: 10,
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
    socket.value.io.on('reconnect_failed', handleReconnectFailed);
    socket.value.on('error', handleError);

    // ── Auth: Force-Disconnect Listener ──────────────────────────────
    // Fired by MSAB when the user is blocked/suspended by an admin.
    // The infrastructure layer just forwards the payload — REACT logic
    // (suspension state, socket teardown, navigation) lives in
    // useAuthLifecycle, so this file stays infrastructure-only.
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
      });
    });
  }

  /**
   * Disconnect from the audio server and clean up resources.
   * Clears all module-level singleton state so the next login starts fresh.
   */
  function disconnect(preserveReconnectCallback = false) {
    if (socket.value) {
      socket.value.removeAllListeners();
      socket.value.disconnect();
      socket.value = null;
    }
    status.value = 'disconnected';
    error.value = null;
    _connectedUrl = null;
    if (!preserveReconnectCallback) {
      _reconnectCallback = null;
    }
    _hiddenSince = null;
    _authRetryInFlight = false;
    // Reset handlers so they can be re-registered on next connection
    resetRealtimeHandlers();
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
   * GATE:    Skip if no socket exists or hidden < 5s (let Socket.IO handle naturally).
   * EXECUTE: Only force a reconnect when the socket truly looks dead. If
   *          `socket.connected === true` we trust engine.io's built-in ping/pong
   *          heartbeat and do nothing — yanking a healthy connection triggers
   *          MSAB's in-process seat-grace timer (F-6) and the post-resume seat
   *          flicker (F-24). If `socket.connected === false` we trigger a direct
   *          `connect()` so the user sees an immediate reconnect attempt.
   * REACT:   Logging only — room rejoin is handled by Watcher 3 via _reconnectCallback.
   *
   * NOTE: After the §13.8 health-first resume work, `useRoomLifecycle`'s
   * Watcher 4 no longer calls this method on every visibility change — the
   * `probeAudioHealth()` flow drives recovery decisions instead. This function
   * is kept for any future callers that want an explicit "verify and reconnect
   * if dead" hook.
   */
  async function recoverFromSuspension(): Promise<void> {
    const hiddenMs = _hiddenSince ? Date.now() - _hiddenSince : 0;
    _hiddenSince = null;

    if (!socket.value) return;

    if (hiddenMs < 5_000) {
      return;
    }

    if (!socket.value.connected) {
      socket.value.connect();
      return;
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
