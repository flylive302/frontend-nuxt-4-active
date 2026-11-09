/**
 * Room Audio Player — thin DJ-session orchestrator.
 *
 * Composes three deep modules and owns nothing they own:
 *  - {@link PlaylistQueue}             — the ordered Playlist (cheap `File` handles).
 *  - {@link createAudioPlaybackEngine} — the Web Audio graph + decode/swap.
 *  - {@link useMediasoupStreaming}     — the stable music producer lifecycle.
 *  - {@link useSavedPlaylist}          — the device (IndexedDB) copy of the
 *    Playlist, so it survives the app process dying (room-music-playlist/01).
 *
 * It contains **no raw Web Audio graph code** (that lives in the engine) and no
 * queue arithmetic (that lives in the model). Its only job is the
 * INTENT → GATE → EXECUTE → REACT pipeline that wires a DJ action to those
 * modules plus the MSAB mutex/metadata socket coordination.
 *
 * Headline feature (PRD): a DJ picks multiple files and they **auto-advance** —
 * the engine's natural-end callback drives `queue.next()` and the engine swaps
 * the next decoded source onto the **stable output track**, so the mediasoup
 * `musicProducer` is produced exactly once and listeners never re-consume
 * (gapless boundary). See ADR 0006 (single-DJ, client-local; device-persistent
 * since room-music-playlist/01 — never uploaded).
 */
import type { Ref } from 'vue';
import type { AudioSocket } from '../useAudioSocket';
import type {
  AudioPlayerState,
  AudioPlayerPlayPayload,
  AudioPlayerStopPayload,
  AudioPlayerLeaveQueuePayload,
  AudioPlayerStateUpdatePayload,
  AudioPlayerStateChangedEvent,
  AudioPlayerRevokedEvent,
  AudioPlayerGrantedEvent,
  AudioPlayerTakeoverPayload,
  AudioPlayerResponse,
  MusicPlayerJoinState,
  Track,
} from '~/types/room/audio-player';
import {
  createAudioPlaybackEngine,
  AudioPlaybackError,
  type AudioPlaybackEngine,
} from '~/services/audioPlaybackEngine';
import { PlaylistQueue } from '~/utils/playlist-queue';
import { useSavedPlaylist } from './useSavedPlaylist';
import { createEmitAsync } from '~/utils/socket';
import { createLogger } from '~/utils/logger';
import { percentToFraction } from '~/utils/audio/duck-level';
import { useAudioPreferencesStore } from '~/stores/audioPreferences';
import {
  AUDIO_DUCK_RAMP_DOWN_MS,
  AUDIO_DUCK_RAMP_UP_MS,
  ROOM_VIDEO_ERROR,
} from '~/constants/room';

// ============================================
// Module-level state (singleton across composable calls)
// ============================================
const playerState = reactive<AudioPlayerState>({
  status: 'idle',
  userId: null,
  title: null,
  duration: 0,
  position: 0,
});

/** Reactive mirror of the (non-reactive) queue model for UI consumption. */
const queueTracks = ref<Track[]>([]);
const currentTrackId = ref<string | null>(null);

/**
 * Whether the DJ's player panel is open. Decoupled from playback `status` so the
 * panel persists across Stop / end-of-queue (the DJ can replay the kept queue)
 * and closes only via the explicit ✕ (`closePlayer`), force-take, or leave.
 */
const isPlayerOpen = ref(false);

/**
 * music-dj-queue/04: waiting-queue state. Set when a play against a live DJ is
 * denied-but-enqueued; cleared on grant (auto-start), leave/cleanup, close, or
 * revoke. Module-level like {@link isPlayerOpen} — one DJ session per tab. The
 * server-side dequeue on cancel/leave is ticket 05; here the client only tracks
 * and clears its own waiting flag.
 */
const isWaitingForSlot = ref(false);
const queuePosition = ref<number | null>(null);

/**
 * Talk-over duck (ADR 0018): true while the music gain is ducked, whether from
 * a real hold (`duckStart`/`duckEnd`) or a settings-drawer slider preview
 * (`previewDuck`/`releasePreview`). Module-level like {@link isPlayerOpen} —
 * one DJ session per tab.
 */
const isDucking = ref(false);

// Composed modules (not reactive — internal only).
const queue = new PlaylistQueue();
let engine: AudioPlaybackEngine | null = null;

/**
 * room-music-playlist/01: which account the in-memory queue belongs to
 * (reactive — the deck hides the moment a different account is signed in), and
 * which account's saved Playlist has already been restored this session. A
 * different account signing in on the same tab gets an empty queue plus its
 * own saved songs — never the previous account's.
 */
const queueOwnerKey = ref<string | null>(null);
let restoredForUserKey: string | null = null;

let positionInterval: ReturnType<typeof setInterval> | null = null;
let stateUpdateInterval: ReturnType<typeof setInterval> | null = null;

// ============================================
// Composable
// ============================================

/**
 * Room Audio Player — DJ-session orchestrator.
 *
 * @param socket - Ref to the audio socket connection
 */
export function useRoomAudioPlayer(socket: Ref<AudioSocket | null>) {
  const log = createLogger('[AudioPlayer]');
  const emitAsync = createEmitAsync(socket);

  // Cache store refs at init (Vue setup context) — handlers may run from socket
  // callbacks or timers outside setup, where useXStore() would throw.
  const authStore = useAuthStore();
  const roomStore = useRoomStore();
  const { isRoomOwner, isRoomAdmin } = useRoomPermissions();
  const toast = useToast();
  const savedPlaylist = useSavedPlaylist();

  // Stable music producer lifecycle (shared via the session store).
  const { produceTrack, stopMusicProducer } = useMediasoupStreaming(socket);

  // ========================================
  // Computed
  // ========================================
  const isPlaying = computed(() => playerState.status === 'playing');
  const isPaused = computed(() => playerState.status === 'paused');
  const isActive = computed(() => playerState.status === 'playing' || playerState.status === 'paused');
  const isMusicPlayingInRoom = computed(() => playerState.userId !== null && playerState.status !== 'idle' && playerState.status !== 'stopped');

  /**
   * Whether this user may DJ in the *current* Room — owner or admin, the same
   * rule as the Settings hub's `canEdit`. The admin half flips true late (the
   * membership row loads asynchronously on room mount).
   */
  const canDjInRoom = computed(() => isRoomOwner.value || isRoomAdmin.value);

  /** The in-memory Playlist belongs to the signed-in account (or to nobody yet). */
  const isQueueMine = computed(() =>
    queueOwnerKey.value === null || queueOwnerKey.value === savedPlaylist.currentUserKey(),
  );

  /**
   * Show the DJ panel to its owner whenever it is open AND nobody *else* holds
   * the slot. Driven by an explicit open flag (not playback `status`), so Stop /
   * end-of-queue keep it visible; a force-take by the owner hides the displaced
   * DJ's panel because the active player becomes someone else.
   *
   * room-music-playlist/01 (cause 1): `cleanup()` leaves the panel open when a
   * Playlist is retained, so the role gate decides whether it shows in the
   * Room being (re)joined — a DJ who walks into a Room where they are only a
   * member does not get a deck they cannot use. A live session (`isActive`)
   * always shows, so a transient membership refetch failure can never strip
   * the controls off audible music. After a logout → login on the same tab the
   * previous account's queue is never shown (`isQueueMine`), even before the
   * next join's restore clears it.
   */
  const isPlayerVisible = computed(() =>
    isPlayerOpen.value &&
    isQueueMine.value &&
    (isActive.value || canDjInRoom.value) &&
    !(isMusicPlayingInRoom.value && playerState.userId !== authStore.user?.id),
  );

  // music-dj-queue/04: this DJ is enqueued behind a live DJ, awaiting a grant.
  const isWaiting = computed(() => isWaitingForSlot.value);

  const currentIndex = computed(() => queueTracks.value.findIndex((t) => t.id === currentTrackId.value));
  const hasNext = computed(() => currentIndex.value >= 0 && currentIndex.value < queueTracks.value.length - 1);
  const hasPrev = computed(() => currentIndex.value > 0);

  // ========================================
  // Internal: queue mirror + engine lifecycle
  // ========================================

  /** Push the queue model's state into the reactive mirror after a mutation. */
  function syncQueue(): void {
    queueTracks.value = queue.tracks.slice();
    currentTrackId.value = queue.current?.id ?? null;
  }

  /** Lazily build the per-session engine and wire its natural-end callback. */
  function ensureEngine(): AudioPlaybackEngine {
    if (engine) return engine;
    engine = createAudioPlaybackEngine();
    engine.setOnEnded(() => { void advance(); });
    return engine;
  }

  /** Decode-prefetch the track after the current one so the boundary is gapless. */
  function primeNext(): void {
    if (!engine) return;
    const next = queueTracks.value[currentIndex.value + 1];
    if (next) engine.prefetch(next.id, next.file);
  }

  // ========================================
  // Internal: position + state relays (REACT)
  // ========================================

  function startPositionTracking(): void {
    stopPositionTracking();
    positionInterval = setInterval(() => {
      if (engine) playerState.position = engine.getPosition();
    }, 250); // Update UI 4x per second
  }

  function stopPositionTracking(): void {
    if (positionInterval) {
      clearInterval(positionInterval);
      positionInterval = null;
    }
  }

  function startStateUpdates(roomId: string): void {
    stopStateUpdates();
    stateUpdateInterval = setInterval(() => {
      if (!socket.value || !engine) return;
      socket.value.emit('audioPlayer:stateUpdate', {
        roomId,
        position: engine.getPosition(),
        isPaused: playerState.status === 'paused',
      } satisfies AudioPlayerStateUpdatePayload);
    }, 2000); // Send state to MSAB every 2s
  }

  function stopStateUpdates(): void {
    if (stateUpdateInterval) {
      clearInterval(stateUpdateInterval);
      stateUpdateInterval = null;
    }
  }

  // ========================================
  // Internal: per-track start (EXECUTE) + error (REACT)
  // ========================================

  /**
   * Decode + play `track` on the engine, broadcast its metadata to the room,
   * and update reactive state. Used for the first track and every advance.
   *
   * @param isFirst - the session-opening track; a mutex denial here aborts.
   * @param force - owner force-take: use `audioPlayer:takeover` (overwrites the
   *   mutex + revokes the displaced DJ) instead of the contended `play` acquire.
   * @returns whether the track started.
   */
  async function startTrack(
    roomId: string,
    track: Track,
    isFirst: boolean,
    force = false,
  ): Promise<boolean> {
    playerState.status = 'loading';

    let duration: number;
    try {
      ({ duration } = await ensureEngine().play(track.id, track.file));
    } catch (err) {
      onPlaybackError(err, track);
      return false;
    }
    track.duration = duration;

    // MSAB mutex (first track) / now-playing metadata broadcast (every track).
    // Owner force-take overwrites the slot; a plain play is denied when another
    // admin already holds it (story 20: the admin retries, no auto-grab).
    const event = force ? 'audioPlayer:takeover' : 'audioPlayer:play';
    // music-dj-queue/04: opt into the waiting queue only for the non-force first
    // acquire. Track changes (isFirst=false) and takeover must never enqueue.
    const wantsQueue = event === 'audioPlayer:play' && isFirst;
    let res: AudioPlayerResponse;
    try {
      res = await emitAsync<AudioPlayerPlayPayload | AudioPlayerTakeoverPayload, AudioPlayerResponse>(
        event,
        { roomId, title: track.title, duration, ...(wantsQueue ? { enqueue: true } : {}) },
      );
    } catch (err) {
      // EXECUTE failure (socket timeout / disconnect): surface a clean toast and
      // bail — never let the rejection bubble up as an unhandled promise. Callers
      // (`startSession` / `advance`) tear the session down on a `false` return.
      log.warn('Music socket request failed', err);
      engine?.stop();
      playerState.status = 'stopped';
      toast.add({
        title: 'Music',
        description: force
          ? 'Could not take over playback — the music server did not respond. Please try again.'
          : 'Could not reach the music server. Please try again.',
        color: 'error',
      });
      return false;
    }
    if (isFirst && !res.success) {
      engine?.stop();
      playerState.status = 'idle';

      // music-dj-queue/04: denied-but-enqueued → show the waiting state (no error
      // toast). The waiting flag is set here and deliberately survives the
      // producer teardown in startSession's failure path (stopStreaming does NOT
      // clear it — only close/leave/revoke/grant do); the grant later re-runs
      // startSession, whose play succeeds via reuse-if-mine.
      if (res.queued) {
        isWaitingForSlot.value = true;
        queuePosition.value = res.position ?? null;
        toast.add({
          title: 'Music',
          description: `You're #${res.position ?? '?'} in line — your music starts automatically when the current DJ finishes.`,
          color: 'info',
        });
        return false;
      }

      toast.add({
        title: 'Music',
        description: describePlayRefusal(res, force),
        color: 'warning',
      });
      return false;
    }

    playerState.status = 'playing';
    playerState.userId = authStore.user?.id ?? null;
    playerState.title = track.title;
    playerState.duration = duration;
    playerState.position = 0;

    syncQueue();
    primeNext();
    savedPlaylist.rememberPlayed(track.id); // REACT: recency for eviction
    return true;
  }

  /** Auto-advance: engine reports natural end → advance the queue or stop. */
  async function advance(): Promise<void> {
    const roomId = roomStore.currentRoom?.id?.toString();
    if (!roomId) return;

    const next = queue.next();
    if (!next) {
      stopStreaming(roomId); // end of queue: stop cleanly, keep the queue
      return;
    }
    const ok = await startTrack(roomId, next, false);
    if (!ok) stopStreaming(roomId);
  }

  function onPlaybackError(err: unknown, track: Track): void {
    log.warn('Playback failed', err);
    toast.add({ title: 'Music Error', description: playbackErrorMessage(err, track), color: 'error' });
  }

  /**
   * room-music-playlist/01: a song restored from the device store whose bytes
   * are gone (the OS evicted storage — `persist()` is best-effort) is not a
   * codec problem: mark the row and tell the DJ to remove it instead of
   * suggesting a re-export.
   */
  function playbackErrorMessage(err: unknown, track: Track): string {
    if (track.unavailable || (savedPlaylist.isRestored(track.id) && isUnreadableBlobError(err))) {
      queue.markUnavailable(track.id);
      syncQueue();
      return `"${track.title}" is no longer saved on this device. Remove it and add the song again.`;
    }
    return err instanceof AudioPlaybackError
      ? err.message
      : `Could not play "${track.title}" — the file's encoding may be unsupported or corrupt. Try re-exporting as MP3 or AAC.`;
  }

  // ========================================
  // Public: Playlist mutations
  // ========================================

  /**
   * Append the picked files to the Playlist (capped by the model). When a
   * session is already live the new tracks join without interrupting playback;
   * the next-track prefetch is refreshed. Returns the tracks actually appended
   * (fewer than `files` if the cap was hit) so the caller can report drops.
   */
  function addTracks(files: File[]): Track[] {
    const created = queue.add(files);
    syncQueue();
    if (created.length > 0) isPlayerOpen.value = true; // reveal the DJ panel
    if (isActive.value) primeNext();

    // REACT (room-music-playlist/01): copy the songs to the device store so the
    // Playlist survives an app kill. Fire-and-forget — the DJ never waits.
    if (created.length > 0) {
      queueOwnerKey.value = savedPlaylist.currentUserKey();
      savedPlaylist.rememberAdded(created, queueTrackIds());
    }
    return created;
  }

  /** Current queue order as track ids (input to the saved-order writes). */
  function queueTrackIds(): string[] {
    return queue.tracks.map((t) => t.id);
  }

  /** REACT: persist the current queue order so a restore reproduces it. */
  function persistOrder(): void {
    savedPlaylist.rememberOrder(queueTrackIds());
  }

  /**
   * Reorder the Playlist (drag-to-reorder UI). Pure queue-data change: the
   * model keeps the same track `current`, so playback is **not** interrupted —
   * only the upcoming order (and thus the prefetched next track) changes.
   */
  function reorderTracks(fromIndex: number, toIndex: number): void {
    queue.reorder(fromIndex, toIndex);
    syncQueue();
    primeNext();
    persistOrder();
  }

  /**
   * Remove a track. Removing the current track skips to the next (and keeps
   * playing if a session is live); removing the last remaining track stops.
   */
  async function removeTrack(id: string, roomId: string): Promise<void> {
    const wasCurrent = queue.current?.id === id;
    queue.remove(id);
    syncQueue();
    savedPlaylist.forget(id); // REACT: drop the saved copy
    persistOrder();

    if (!wasCurrent) {
      primeNext();
      return;
    }
    if (!queue.current) {
      stopStreaming(roomId); // removed the last track
      return;
    }
    if (isActive.value) {
      await startTrack(roomId, queue.current, false); // skip to the slid-up track
    }
  }

  // ========================================
  // Public: Playback controls
  // ========================================

  /**
   * Start the DJ session: produce the engine's stable output track once, then
   * play the current queue track. Shared by the normal acquire (`play`) and the
   * owner force-take (`takeover`).
   *
   * @returns whether playback started (false if the slot was denied).
   */
  async function startSession(roomId: string, force: boolean): Promise<boolean> {
    if (!queue.current) return false;

    // music-dj-queue/05 GATE: re-pressing play while already enqueued must not
    // re-produce or re-toast the denial — nudge once and bail. handleGranted
    // clears the waiting flag BEFORE it calls startSession, so the grant path is
    // never gated here (regression-guarded in the spec).
    if (isWaitingForSlot.value) {
      toast.add({
        title: 'Music',
        description: queuePosition.value != null
          ? `You're #${queuePosition.value} in line — your music starts automatically.`
          : `You're in line — your music starts automatically.`,
        color: 'info',
      });
      return false;
    }

    isPlayerOpen.value = true; // keep the panel up even if the slot is denied
    const outputTrack = ensureEngine().getOutputTrack();

    // `produceTrack` awaits transport creation, so the engine can be disposed
    // underneath us mid-call (owner force-take via `handleRevoked`, leave,
    // stop). Disposal closes the AudioContext, which ends `outputTrack`, and
    // mediasoup's `produce()` then throws InvalidStateError. That is teardown,
    // not a user error — tear down cleanly instead of rejecting into the click.
    try {
      await produceTrack(outputTrack);
    } catch (err) {
      log.warn('produceTrack failed during startSession (usually teardown mid-start)', err);
      stopStreaming(roomId);
      return false;
    }

    const ok = await startTrack(roomId, queue.current, true, force);
    if (!ok) {
      stopStreaming(roomId);
      return false;
    }

    startPositionTracking();
    startStateUpdates(roomId);
    return true;
  }

  /**
   * Acquire a free slot and start playing (or resume from a Stop). Denied when
   * another DJ already holds the slot — the caller does not auto-grab.
   */
  function play(roomId: string): Promise<boolean> {
    return startSession(roomId, false);
  }

  /**
   * Owner-only force-take of a live slot: overwrites the mutex, revokes the
   * displaced DJ (server-side), and starts the owner's queue. The displaced
   * DJ's queue is preserved on their device for resume.
   */
  function takeover(roomId: string): Promise<boolean> {
    return startSession(roomId, true);
  }

  /** Manual skip to the next track (no-op at the end of the queue). */
  async function next(roomId: string): Promise<void> {
    const track = queue.next();
    if (track) await startTrack(roomId, track, false);
  }

  /** Manual skip back (restarts the current track at the start of the queue). */
  async function prev(roomId: string): Promise<void> {
    const track = queue.prev();
    if (track) await startTrack(roomId, track, false);
  }

  /**
   * Drawer tap-to-play: jump the queue to `id` and play it, re-opening the
   * floating deck if the DJ had dismissed it with ✕ (slice 05 — a queued track
   * must always be playable, not just a freshly-uploaded one). Starts a new
   * session when nothing is live (mirrors `play`); switches in place when a
   * session is already active (mirrors manual `next` / `prev`). A stale or
   * unknown `id` (e.g. a race with a concurrent delete) is a no-op.
   */
  async function playTrack(roomId: string, id: string): Promise<void> {
    const track = queue.select(id);
    if (!track) return;

    syncQueue();
    isPlayerOpen.value = true; // reveal the deck even if it was closed via ✕

    if (isActive.value) {
      await startTrack(roomId, track, false); // session already live — switch track
    } else {
      await startSession(roomId, false); // idle/stopped — (re)acquire the slot
    }
  }

  /** Pause playback (engine suspends → producer sends silence). */
  async function pause(): Promise<void> {
    if (!engine || playerState.status !== 'playing') return;
    await engine.pause();
    playerState.status = 'paused';
    playerState.position = engine.getPosition();
    stopPositionTracking();
  }

  /** Resume from the paused position. */
  async function resume(): Promise<void> {
    if (!engine || playerState.status !== 'paused') return;
    await engine.resume();
    playerState.status = 'playing';
    startPositionTracking();
  }

  /** Seek within the current track (engine swaps the source). */
  function seek(position: number): void {
    if (!engine) return;
    engine.seek(position);
    playerState.position = engine.getPosition();
  }

  /** Set output volume 0–1. */
  function setVolume(volume: number): void {
    engine?.setVolume(volume);
  }

  /**
   * Talk-over duck (ADR 0018): holding the player vinyl ramps the music gain
   * down for the Room and the DJ's own monitor alike (one gain feeds both).
   * No-op with nothing playing — there is no engine to duck.
   */
  function duckStart(): void {
    const fraction = percentToFraction(useAudioPreferencesStore().duckLevelPercent);
    engine?.duck(fraction, AUDIO_DUCK_RAMP_DOWN_MS);
    isDucking.value = true;
  }

  /** Release the talk-over duck, restoring the pre-duck (slider) volume. */
  function duckEnd(): void {
    engine?.releaseDuck(AUDIO_DUCK_RAMP_UP_MS);
    isDucking.value = false;
  }

  /**
   * Settings-drawer duck-level preview: ducks to `percent` immediately (no
   * hold gesture) so the user hears the effect while dragging the slider.
   * No-op with nothing playing — mirrors `duckStart`.
   */
  function previewDuck(percent: number): void {
    engine?.duck(percentToFraction(percent), AUDIO_DUCK_RAMP_DOWN_MS);
    isDucking.value = true;
  }

  /** Release a settings-drawer preview duck. Mirrors `duckEnd`. */
  function releasePreview(): void {
    engine?.releaseDuck(AUDIO_DUCK_RAMP_UP_MS);
    isDucking.value = false;
  }

  /**
   * Stop streaming but **preserve the queue** for in-session resume: close the
   * music producer, tear down the engine, release the MSAB mutex. Also the
   * clean end-of-queue / remove-last path. The queue clears only on leave.
   *
   * music-dj-queue/04 (deviation from the literal contract, advisor-confirmed):
   * this does NOT clear the waiting state, because startSession's failure path
   * calls it right after a denied-but-enqueued play to tear down the producer —
   * clearing here would wipe the waiting flag we just set. The waiting cancel
   * paths are `closePlayer`, `cleanup`, `handleRevoked`, and `handleGranted`.
   */
  function stopStreaming(roomId: string): void {
    stopPositionTracking();
    stopStateUpdates();

    stopMusicProducer();
    engine?.dispose();
    engine = null;

    if (socket.value) {
      emitAsync<AudioPlayerStopPayload, AudioPlayerResponse>('audioPlayer:stop', { roomId })
        .catch((err) => { log.warn('Failed to emit audioPlayer:stop', err); });
    }

    playerState.status = 'stopped';
    playerState.userId = null;
    playerState.title = null;
    playerState.duration = 0;
    playerState.position = 0;
  }

  /**
   * Explicit ✕ dismiss of the DJ panel. Stops playback first if a session is
   * live (so we never orphan an audible stream), then hides the panel. The queue
   * is preserved — reopening via the "Play Music" picker resumes it.
   */
  function closePlayer(roomId: string): void {
    if (isActive.value) stopStreaming(roomId);
    // music-dj-queue/05: closing while enqueued cancels the spot server-side too
    // (dequeue), then clears the local waiting flag. Fire-and-forget REACT — the
    // ack is irrelevant; do it BEFORE clearWaiting so the emit still fires.
    cancelWaitingSpot(roomId);
    clearWaiting();
    isPlayerOpen.value = false;
  }

  /** music-dj-queue/04: reset the local waiting flag. */
  function clearWaiting(): void {
    isWaitingForSlot.value = false;
    queuePosition.value = null;
  }

  /**
   * music-dj-queue/05: tell MSAB to drop our waiting-queue spot (LREM). Only when
   * we are actually enqueued and the socket is alive — a fire-and-forget REACT
   * emit (the ack is irrelevant). Callers invoke this BEFORE clearWaiting so the
   * guard still sees the waiting flag. A revoke does NOT use this: a revoked user
   * was the DJ, not a waiter.
   */
  function cancelWaitingSpot(roomId: string): void {
    if (!isWaitingForSlot.value || !socket.value) return;
    emitAsync<AudioPlayerLeaveQueuePayload, AudioPlayerResponse>('audioPlayer:leaveQueue', { roomId })
      .catch((err) => { log.warn('Failed to emit audioPlayer:leaveQueue', err); });
  }

  /**
   * music-dj-queue/04: the slot freed and MSAB granted it to us (targeted
   * `audioPlayer:granted`). Auto-start our first queued track via the normal play
   * flow — the play inside `startSession` succeeds via reuse-if-mine against the
   * provisional mutex the server already SET to us.
   *
   * Runs from a socket callback, so it uses the store refs cached at composable
   * init. GATE: must actually be waiting, have a track to play, and match the
   * current room — otherwise ignore silently.
   */
  function handleGranted(event: AudioPlayerGrantedEvent): void {
    if (!isWaitingForSlot.value) return;
    if (!queue.current) return;
    if (event.roomId !== roomStore.currentRoom?.id?.toString()) return;

    clearWaiting();
    void startSession(event.roomId, false).then((ok) => {
      if (!ok) {
        // Grant start failed (e.g. lost the reuse race) — do NOT re-enqueue; the
        // playlist is retained so the DJ can retry manually. Waiting already clear.
        log.warn('Music grant auto-start failed');
        return;
      }
      toast.add({ title: 'Music', description: 'Your music is starting.', color: 'info' });
    });
  }

  /**
   * The slot was taken from this DJ (targeted `audioPlayer:revoked`): the room
   * owner force-took the music, or (`reason: 'video'`, room-video-player/03) a
   * Room Video took the media slot. Tear down local production so this DJ is no
   * longer audible — the Room never hears two tracks — but **preserve the queue**
   * for resume when the slot frees. We do NOT emit `audioPlayer:stop`: the server
   * already released / reassigned the mutex.
   */
  function handleRevoked(event: AudioPlayerRevokedEvent): void {
    stopPositionTracking();
    stopStateUpdates();
    stopMusicProducer();
    engine?.dispose();
    engine = null;

    clearWaiting(); // music-dj-queue/04: a revoke also cancels any waiting state
    isPlayerOpen.value = false; // hide the displaced DJ's panel (queue is kept)

    playerState.title = null;
    playerState.duration = 0;
    playerState.position = 0;

    if (event.reason === 'video') {
      // No music is playing now (the server sent `stateChanged stopped` about us,
      // which this client drops as its own). Silent when we started the video.
      playerState.status = 'idle';
      playerState.userId = null;
      if (event.byUserId === authStore.user?.id) return;
      toast.add({
        title: 'Music',
        description: 'Music stopped because a video started in the room. Your playlist is kept.',
        color: 'info',
      });
      return;
    }

    // Reflect "someone else is now playing" immediately so the DJ-only player
    // hides without waiting for the owner's stateChanged broadcast to arrive.
    playerState.status = 'playing';
    playerState.userId = event.byUserId;

    toast.add({
      title: 'Music',
      description: 'The room owner took over music playback. Your playlist is kept — play again when the slot is free.',
      color: 'info',
    });
  }

  // ========================================
  // Socket Event Listeners
  // ========================================

  /** Listen for other DJs' state broadcasts (passive listeners). */
  function setupListeners(): void {
    if (!socket.value) return;

    socket.value.on('audioPlayer:revoked', handleRevoked);
    socket.value.on('audioPlayer:granted', handleGranted); // music-dj-queue/04

    socket.value.on('audioPlayer:stateChanged', (event: AudioPlayerStateChangedEvent) => {
      // Don't override local state from our own broadcast.
      if (event.userId === authStore.user?.id) return;

      switch (event.state) {
        case 'playing':
          playerState.status = 'playing';
          playerState.userId = event.userId;
          playerState.title = event.title ?? null;
          playerState.duration = event.duration ?? 0;
          playerState.position = event.position;
          break;
        case 'paused':
          playerState.status = 'paused';
          playerState.position = event.position;
          break;
        case 'stopped':
          playerState.status = 'idle';
          playerState.userId = null;
          playerState.title = null;
          playerState.duration = 0;
          playerState.position = 0;
          break;
      }
    });
  }

  function cleanupListeners(): void {
    if (!socket.value) return;
    socket.value.off('audioPlayer:stateChanged');
    socket.value.off('audioPlayer:revoked', handleRevoked);
    socket.value.off('audioPlayer:granted', handleGranted); // music-dj-queue/04
  }

  /** Sync UI when joining a room where music is already playing. */
  function initFromJoinState(musicPlayer: MusicPlayerJoinState | null): void {
    if (!musicPlayer) return;

    playerState.status = musicPlayer.isPaused ? 'paused' : 'playing';
    playerState.userId = musicPlayer.userId;
    playerState.title = musicPlayer.title;
    playerState.duration = musicPlayer.duration;
    playerState.position = musicPlayer.position;
  }

  /**
   * room-music-playlist/01: rebuild the Playlist from the device store after a
   * reload / app kill. Called (fire-and-forget) on every room join; runs at most
   * once per account per JS session, so reconnect re-joins are a no-op. A
   * failed read is retried on the next join.
   */
  async function restoreSavedPlaylist(): Promise<void> {
    const userKey = savedPlaylist.currentUserKey();
    if (!canRestoreFor(userKey)) return;
    adoptQueueFor(userKey);
    const restored = await rebuildQueueFrom(userKey);
    if (restored > 0) revealRestoredPlaylist(restored);
  }

  /** GATE: signed in and not yet restored for this account this session. */
  function canRestoreFor(userKey: string | null): userKey is string {
    return userKey !== null && restoredForUserKey !== userKey;
  }

  /**
   * EXECUTE (sync): claim the queue for `userKey`. An account switch drops the
   * previous account's in-memory queue (its saved copy stays on disk).
   */
  function adoptQueueFor(userKey: string): void {
    if (queueOwnerKey.value !== null && queueOwnerKey.value !== userKey) {
      queue.clear();
      savedPlaylist.resetBindings();
      syncQueue();
      isPlayerOpen.value = false;
    }
    restoredForUserKey = userKey;
    queueOwnerKey.value = userKey;
  }

  /**
   * EXECUTE: append the saved songs (after anything added while loading) and
   * bind them to their storage keys; songs whose bytes are gone come back as
   * unavailable rows. Returns how many tracks were rebuilt.
   */
  async function rebuildQueueFrom(userKey: string): Promise<number> {
    const saved = await savedPlaylist.loadSaved(userKey);
    const accountChanged = savedPlaylist.currentUserKey() !== userKey;
    if (saved === null || accountChanged) {
      // Read failed, or signed out / switched mid-read: allow a later retry.
      if (restoredForUserKey === userKey) restoredForUserKey = null;
      return 0;
    }

    const created = queue.add(saved.map((s) => s.file));
    savedPlaylist.bindRestored(created.map((t, i) => ({ trackId: t.id, key: saved[i]!.key })));
    created.forEach((t, i) => {
      if (saved[i]!.unavailable) queue.markUnavailable(t.id);
    });
    syncQueue();
    return created.length;
  }

  /** REACT: reveal the deck (the role gate still decides visibility) and re-persist order. */
  function revealRestoredPlaylist(count: number): void {
    isPlayerOpen.value = true;
    if (isActive.value) primeNext();
    // Songs added while the read was in flight sit ahead of the restored ones;
    // re-persist the merged order so the next restore matches what the DJ sees.
    persistOrder();
    log.info('Restored saved playlist', { tracks: count });
  }

  /**
   * Playback/streaming teardown on room leave (covers manual leave, room
   * switch, kick/eject, and room-closed — every path funnels through this one
   * `cleanup()`, see `useRoomAudio.leaveRoom`): stop production, release the
   * MSAB mutex (via `stopStreaming`'s `audioPlayer:stop`) when a session was
   * live, drop socket listeners, reset playback state.
   *
   * Panel: room-music-playlist/01 (cause 1) — this used to hide the panel
   * unconditionally, and nothing re-opened it on rejoin, so a retained Playlist
   * looked "lost". Now the panel stays open iff a Playlist is retained; the
   * role gate in `isPlayerVisible` decides whether it shows in the next Room.
   * Socket reconnects re-join without passing through here, so a deck the DJ
   * dismissed with ✕ stays dismissed across network blips.
   *
   * The in-memory Playlist (`queue`) is deliberately **not** cleared here —
   * PRD "Playlist retention" (stories 18–21): a DJ's queue survives room
   * switches, kicks, and owner takeover within the same browser session.
   * `handleRevoked` already preserves it the same way. A reload or app kill
   * resets this module's singleton state; since room-music-playlist/01 the
   * queue is then rebuilt from the device store by `restoreSavedPlaylist` on
   * the next join. An account switch clears it there too (per-user Playlist).
   * Logout also flows through this same `cleanup()` via the `currentRoom`
   * watcher — do not clear the queue here.
   */
  function cleanup(roomId?: string): void {
    if (roomId && isActive.value) {
      stopStreaming(roomId);
    } else {
      stopPositionTracking();
      stopStateUpdates();
      engine?.dispose();
      engine = null;
    }
    cleanupListeners();

    // music-dj-queue/05: leaving while enqueued cancels the spot server-side too.
    // `roomId` is undefined on some leave paths — fall back to the current room;
    // skip the emit (but still clear locally) if none is resolvable.
    const queueRoomId = roomId ?? roomStore.currentRoom?.id?.toString();
    if (queueRoomId) cancelWaitingSpot(queueRoomId);
    clearWaiting(); // music-dj-queue/04: leaving cancels any local waiting state
    isPlayerOpen.value = queue.tracks.length > 0; // re-reveal a retained Playlist on rejoin

    playerState.status = 'idle';
    playerState.userId = null;
    playerState.title = null;
    playerState.duration = 0;
    playerState.position = 0;
  }

  // ========================================
  // Return
  // ========================================
  return {
    // State (reactive)
    playerState: readonly(playerState),
    queueTracks: readonly(queueTracks),
    currentTrackId: readonly(currentTrackId),
    queuePosition: readonly(queuePosition),

    // Computed
    isPlaying,
    isPaused,
    isActive,
    isMusicPlayingInRoom,
    isPlayerVisible,
    isWaiting,
    hasNext,
    hasPrev,

    // Playlist mutations
    addTracks,
    removeTrack,
    reorderTracks,

    // Playback controls
    play,
    takeover,
    next,
    prev,
    playTrack,
    pause,
    resume,
    seek,
    stop: stopStreaming,
    closePlayer,
    setVolume,
    duckStart,
    duckEnd,
    previewDuck,
    releasePreview,
    isDucking: readonly(isDucking),

    // Socket integration
    setupListeners,
    cleanupListeners,
    initFromJoinState,
    restoreSavedPlaylist,
    cleanup,
  };
}

/**
 * Whether a playback failure came from reading the song's bytes (blob gone /
 * unreadable) rather than decoding them. The engine wraps both in
 * `AudioPlaybackError`, keeping the original error in `cause`.
 */
function isUnreadableBlobError(err: unknown): boolean {
  const cause = err instanceof AudioPlaybackError ? err.cause : err;
  return cause instanceof DOMException
    && (cause.name === 'NotFoundError' || cause.name === 'NotReadableError');
}

/**
 * Toast copy for a refused first play. room-video-player/03: a live Room Video
 * holds the media slot (`media_slot_busy`, never queued) — the owner's takeover
 * would have ended it, so this is only reached by a plain play.
 */
function describePlayRefusal(res: AudioPlayerResponse, force: boolean): string {
  if (res.error === ROOM_VIDEO_ERROR.MEDIA_SLOT_BUSY && res.data?.heldBy === 'video') {
    return 'A video is playing in the room. Stop it first to play music.';
  }
  return force
    ? 'Could not take over music playback.'
    : 'Another admin is currently playing music. Try again when the slot is free.';
}
