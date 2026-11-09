/**
 * Room Video — socket listeners + join-ack hydration (REACT stage).
 *
 * Maps `videoPlayer:*` socket events and the `room:join` ack onto the Room Video
 * store. No business rules live here: the store owns the revision guard, this file
 * only routes (room check -> store setter -> clock sample).
 *
 * The two handlers are MODULE-SCOPE named functions so `socket.off(name, handler)`
 * always finds the exact reference that `socket.on` registered, even across a
 * rejoin or a second composable call. `boundSocket` remembers which socket they
 * were attached to, so a swapped socket (reconnect) is cleaned up on the OLD one.
 */
import type { Ref } from 'vue';
import type { AudioSocket } from '~/types/room/audio';
import type {
  RoomVideoJoinAckFields,
  VideoPlayerRevokedEvent,
  VideoPlayerStateChangedEvent,
} from '~/types/room/video';
import { useRoomVideoStore } from '~/stores/roomVideo';
import { createLogger } from '~/utils/logger';

// ============================================
// Constants
// ============================================

const STATE_CHANGED_EVENT = 'videoPlayer:stateChanged';
const REVOKED_EVENT = 'videoPlayer:revoked';

const REVOKED_TOAST_TITLE = 'Video';
const REVOKED_BY_MUSIC_COPY = 'Music started, so the video stopped.';
const REVOKED_BY_TAKEOVER_COPY = 'The room owner took over the video.';

const log = createLogger('[RoomVideo]');

// ============================================
// Module-level state (singleton across composable calls)
// ============================================

/**
 * Cached in the composable body (Vue setup context): the handlers below run from
 * socket callbacks, outside setup, where resolving a store / toast is not safe.
 */
let store: ReturnType<typeof useRoomVideoStore> | null = null;
let toast: ReturnType<typeof useToast> | null = null;

/** The socket the handlers are currently attached to, or null. */
let boundSocket: AudioSocket | null = null;

// ============================================
// Handlers (REACT) — stable references
// ============================================

function onStateChanged(event: VideoPlayerStateChangedEvent): void {
  if (!store || event.roomId !== store.roomId) return;

  const receivedAt = Date.now();
  const applied = store.applySnapshot(event.snapshot);
  if (!applied) {
    log.debug('Dropped stale videoPlayer:stateChanged', event.snapshot?.revision);
    return;
  }
  if (event.snapshot) store.addClockSample(event.snapshot.serverTs - receivedAt);
}

function onRevoked(event: VideoPlayerRevokedEvent): void {
  if (!store || event.roomId !== store.roomId) return;

  toast?.add({
    title: REVOKED_TOAST_TITLE,
    description: event.reason === 'music' ? REVOKED_BY_MUSIC_COPY : REVOKED_BY_TAKEOVER_COPY,
    color: 'info',
  });
}

// ============================================
// Attach / detach
// ============================================

/** Idempotent. Removes the exact handlers from the socket they were attached to. */
function cleanupListeners(): void {
  boundSocket?.off(STATE_CHANGED_EVENT, onStateChanged);
  boundSocket?.off(REVOKED_EVENT, onRevoked);
  boundSocket = null;
}

// ============================================
// Composable
// ============================================

export function useRoomVideoListeners(socket: Ref<AudioSocket | null>) {
  const videoStore = useRoomVideoStore();
  store = videoStore;
  toast = useToast();

  /**
   * Hydrate the store from the `room:join` ack. A missing `videoPlayerEnabled`
   * (old MSAB) means the feature is off: nothing is shown, nothing is sampled.
   */
  function applyJoinAck(roomId: string, ack: RoomVideoJoinAckFields, receivedAtMs: number): void {
    const enabled = ack.videoPlayerEnabled === true;

    videoStore.startSession(roomId, enabled);
    videoStore.replaceSnapshot(enabled ? (ack.videoPlayer ?? null) : null);
    if (enabled && typeof ack.serverNow === 'number') {
      videoStore.addClockSample(ack.serverNow - receivedAtMs);
    }
  }

  /** A rejoin must never stack a second listener, so detach first. */
  function setupListeners(): void {
    cleanupListeners();

    const target = socket.value;
    if (!target) return;

    target.on(STATE_CHANGED_EVENT, onStateChanged);
    target.on(REVOKED_EVENT, onRevoked);
    boundSocket = target;
  }

  return { applyJoinAck, setupListeners, cleanupListeners };
}
