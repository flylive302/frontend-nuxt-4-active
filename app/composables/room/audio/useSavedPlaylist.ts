/**
 * Saved Playlist — device persistence for the DJ's queue (room-music-playlist/01).
 *
 * Bridges the pure {@link PlaylistQueue} (owned by `useRoomAudioPlayer`) and the
 * IndexedDB service `playlistTrackStore`. The queue stays pure and its track ids
 * stay session-scoped (`track-N`, reset on reload); this module owns the
 * `queue track id → storage key` map, so saved songs never collide with ids
 * minted after a reload.
 *
 * Every write here is REACT-stage for the DJ's action: fire-and-forget, never
 * awaited, failures logged and (only where the DJ loses something) toasted.
 * Writes run through one serial chain so a remove or reorder issued while a
 * large song is still being copied applies after that copy, never before it.
 *
 * Byte budget (`PLAYLIST_STORAGE_CAP_BYTES`, device-wide across accounts):
 * a new song is saved FIRST, then the least-recently-played saved songs are
 * evicted to get back under budget — so nothing is deleted for a save that then
 * fails. Only when the save itself hits the real storage quota are songs
 * evicted first, then the save retried once. Evicting a song still in the live
 * queue leaves it playable this session (it just won't survive the next app
 * kill) and the DJ is told. Songs from the batch being saved are never evicted.
 *
 * Deliberately NOT a Pinia store and never behind `persist:` — the persisted-
 * state plugin deep-walks the store on every mutation (gift-lag root cause,
 * docs/reference/gotchas/frontend.md). No watchers here, so the one-watch-per-
 * caller trap does not apply; all state is module-scoped (one DJ per tab).
 */
import type { Track } from '~/types/room/audio-player';
import {
  deleteTracks,
  estimateQuotaBytes,
  isPlaylistStorageAvailable,
  listAllRecords,
  listSavedTracks,
  requestPersistentStorage,
  saveTrack,
  touchLastPlayed,
  writePositions,
  type SavedTrackRecord,
} from '~/services/playlistTrackStore';
import { planEviction } from '~/utils/playlist-eviction';
import { createLogger } from '~/utils/logger';
import {
  PLAYLIST_STORAGE_CAP_BYTES,
  PLAYLIST_STORAGE_QUOTA_FRACTION,
} from '~/constants/room';

// ============================================
// Types
// ============================================

/** A queue track paired with the storage key of its saved copy. */
export interface TrackBinding {
  trackId: string;
  key: string;
}

/** A saved song rebuilt for the queue; `unavailable` when its bytes are gone. */
export interface RestorableTrack {
  key: string;
  file: File;
  unavailable: boolean;
}

/** What happened to one save batch — drives the DJ-facing toasts. */
interface SaveBatchOutcome {
  /** Songs that did not fit (budget or real quota) — session-only. */
  overBudget: number;
  /** Songs that failed to save for any other reason — session-only. */
  failed: number;
  /** Live-queue songs evicted to make room — still playable, not saved anymore. */
  displaced: number;
}

// ============================================
// Module-level state (singleton across composable calls)
// ============================================

/** Live-queue track id → storage key, for every track that has (or is getting) a saved copy. */
const keyByTrackId = new Map<string, string>();

/** Track ids rebuilt from storage this session — their bytes come from IndexedDB, not the picker. */
const restoredTrackIds = new Set<string>();

/** Serial write chain — keeps save → reorder → delete in issue order. */
let writeChain: Promise<void> = Promise.resolve();

/** `navigator.storage.persist()` is asked once per session, on the first save. */
let persistRequested = false;

const log = createLogger('[SavedPlaylist]');

// ============================================
// Module helpers
// ============================================

function enqueue(task: () => Promise<void>): void {
  writeChain = writeChain.then(task).catch((err) => {
    log.warn('Saved-playlist write failed', err);
  });
}

/**
 * Saving needs IndexedDB and `crypto.randomUUID` (storage keys). Every runtime
 * we ship has both (Capacitor Android WebView, iOS WKWebView ≥ 15.4, both
 * secure contexts); anywhere else the Playlist silently stays session-only.
 */
function canPersist(): boolean {
  return isPlaylistStorageAvailable()
    && typeof crypto !== 'undefined'
    && typeof crypto.randomUUID === 'function';
}

/** Storage keys for the given queue order, skipping tracks with no saved copy. */
function keysInOrder(orderedTrackIds: readonly string[]): string[] {
  return orderedTrackIds
    .map((id) => keyByTrackId.get(id))
    .filter((key): key is string => key !== undefined);
}

/** Track ids currently bound to one of `keys`. */
function trackIdsForKeys(keys: ReadonlySet<string>): string[] {
  return [...keyByTrackId].filter(([, key]) => keys.has(key)).map(([trackId]) => trackId);
}

async function resolveCapBytes(): Promise<number> {
  const quota = await estimateQuotaBytes();
  if (quota === null) return PLAYLIST_STORAGE_CAP_BYTES;
  return Math.min(PLAYLIST_STORAGE_CAP_BYTES, Math.floor(quota * PLAYLIST_STORAGE_QUOTA_FRACTION));
}

function requestPersistenceOnce(): void {
  if (persistRequested) return;
  persistRequested = true;
  void requestPersistentStorage().then((granted) => {
    log.info('Persistent storage request', { granted });
  });
}

/**
 * EXECUTE: delete `evictKeys` and drop them from `records`. Live-queue songs
 * among them lose their binding (they stay playable, unsaved) and are counted.
 */
async function evict(
  evictKeys: readonly string[],
  records: SavedTrackRecord[],
  outcome: SaveBatchOutcome,
): Promise<void> {
  if (evictKeys.length === 0) return;
  await deleteTracks(evictKeys);
  const evicted = new Set(evictKeys);
  for (let i = records.length - 1; i >= 0; i--) {
    if (evicted.has(records[i]!.key)) records.splice(i, 1);
  }
  for (const trackId of trackIdsForKeys(evicted)) {
    keyByTrackId.delete(trackId);
    restoredTrackIds.delete(trackId);
    outcome.displaced += 1;
  }
  log.info('Evicted saved songs to fit the byte budget', { count: evictKeys.length });
}

/**
 * EXECUTE: save one bound song under the budget (save first, then evict; on a
 * real quota error evict first and retry once). Unbinds it if it ends up unsaved.
 */
async function saveWithinBudget(
  userKey: string,
  binding: TrackBinding,
  file: File,
  position: number,
  records: SavedTrackRecord[],
  capBytes: number,
  batchKeys: ReadonlySet<string>,
  outcome: SaveBatchOutcome,
): Promise<'saved' | 'unsaved' | 'unavailable'> {
  const plan = planEviction(records, batchKeys, file.size, capBytes);
  if (!plan.fits) {
    keyByTrackId.delete(binding.trackId);
    outcome.overBudget += 1;
    return 'unsaved';
  }

  const record: SavedTrackRecord = {
    key: binding.key,
    userId: userKey,
    name: file.name,
    type: file.type,
    size: file.size,
    position,
    addedAt: Date.now(),
    lastPlayedAt: null,
  };

  let result = await saveTrack(record, file);
  let evicted = false;
  if (result === 'quota' && plan.evictKeys.length > 0) {
    await evict(plan.evictKeys, records, outcome);
    evicted = true;
    result = await saveTrack(record, file);
  }

  if (result === 'saved') {
    records.push(record);
    if (!evicted) await evict(plan.evictKeys, records, outcome);
    return 'saved';
  }
  keyByTrackId.delete(binding.trackId);
  if (result === 'unavailable') return 'unavailable';
  if (result === 'quota') outcome.overBudget += 1;
  else outcome.failed += 1;
  return 'unsaved';
}

// ============================================
// Composable
// ============================================

export function useSavedPlaylist() {
  // Cache store refs at init (setup context) — REACT calls run from socket
  // callbacks / timers where useXStore() would throw.
  const authStore = useAuthStore();
  const toast = useToast();

  /** The signed-in account as a storage owner key, or `null` when signed out. */
  function currentUserKey(): string | null {
    const id = authStore.user?.id;
    return id === undefined || id === null ? null : String(id);
  }

  /** EXECUTE (sync): mint + bind storage keys so later remove/reorder resolve to them. */
  function bindNewTracks(tracks: readonly Track[]): TrackBinding[] {
    return tracks.map((track) => {
      const binding = { trackId: track.id, key: crypto.randomUUID() };
      keyByTrackId.set(binding.trackId, binding.key);
      return binding;
    });
  }

  /** EXECUTE: copy a bound batch into storage under the budget, then persist order. */
  async function saveBatch(
    userKey: string,
    batch: ReadonlyArray<TrackBinding & { file: File }>,
    order: readonly string[],
  ): Promise<SaveBatchOutcome> {
    const outcome: SaveBatchOutcome = { overBudget: 0, failed: 0, displaced: 0 };
    const records = await listAllRecords();
    const capBytes = await resolveCapBytes();
    const batchKeys = new Set(batch.map((b) => b.key));

    for (const entry of batch) {
      // Removed (or account switched) while earlier copies were running.
      if (keyByTrackId.get(entry.trackId) !== entry.key) continue;
      const result = await saveWithinBudget(
        userKey, entry, entry.file, order.indexOf(entry.trackId), records, capBytes, batchKeys, outcome,
      );
      if (result === 'unavailable') return outcome; // no IndexedDB: feature silently off
    }
    await writePositions(keysInOrder(order));
    return outcome;
  }

  /** REACT: tell the DJ about songs that will not survive an app kill. */
  function reportSaveOutcome(outcome: SaveBatchOutcome): void {
    const songs = (n: number) => (n === 1 ? '1 song' : `${n} songs`);
    if (outcome.overBudget > 0) {
      toast.add({
        title: 'Storage full',
        description: `${songs(outcome.overBudget)} won't be saved — gone if the app closes.`,
        color: 'warning',
      });
    }
    if (outcome.failed > 0) {
      toast.add({
        title: 'Music',
        description: `Couldn't save ${songs(outcome.failed)} on this device — gone if the app closes.`,
        color: 'warning',
      });
    }
    if (outcome.displaced > 0) {
      toast.add({
        title: 'Storage full',
        description: `To make room, ${songs(outcome.displaced)} you played longest ago won't be kept if the app closes.`,
        color: 'info',
      });
    }
  }

  /**
   * REACT for "add track": copy the new songs into IndexedDB and record the
   * queue order. Fire-and-forget; the DJ never waits on the copy.
   */
  function rememberAdded(tracks: readonly Track[], orderedTrackIds: readonly string[]): void {
    const userKey = currentUserKey();
    if (!userKey || tracks.length === 0 || !canPersist()) return;

    const batch = bindNewTracks(tracks).map((binding, i) => ({ ...binding, file: tracks[i]!.file }));
    const order = orderedTrackIds.slice();
    requestPersistenceOnce();
    enqueue(async () => {
      reportSaveOutcome(await saveBatch(userKey, batch, order));
    });
  }

  /** REACT for reorder/remove/restore: persist the queue order so restore reproduces it. */
  function rememberOrder(orderedTrackIds: readonly string[]): void {
    if (keyByTrackId.size === 0) return;
    const keys = keysInOrder(orderedTrackIds);
    enqueue(() => writePositions(keys));
  }

  /** REACT for remove: delete the song's saved copy. */
  function forget(trackId: string): void {
    const key = keyByTrackId.get(trackId);
    restoredTrackIds.delete(trackId);
    if (!key) return;
    keyByTrackId.delete(trackId);
    enqueue(() => deleteTracks([key]));
  }

  /** REACT for a successful track start: stamp recency for eviction. */
  function rememberPlayed(trackId: string): void {
    const key = keyByTrackId.get(trackId);
    if (!key) return;
    const at = Date.now();
    enqueue(() => touchLastPlayed(key, at));
  }

  /**
   * Saved songs for `userKey`, in queue order, ready for `queue.add`. A song
   * whose bytes are gone gets an empty placeholder File and `unavailable: true`.
   * `null` when the read failed (retry later); `[]` when nothing is saved.
   */
  async function loadSaved(userKey: string): Promise<RestorableTrack[] | null> {
    const saved = await listSavedTracks(userKey);
    if (saved === null) return null;
    return saved.map(({ record, file }) => ({
      key: record.key,
      file: file ?? new File([], record.name, { type: record.type }),
      unavailable: file === null,
    }));
  }

  /** Bind freshly re-created queue tracks to the saved records they came from. */
  function bindRestored(bindings: readonly TrackBinding[]): void {
    for (const { trackId, key } of bindings) {
      keyByTrackId.set(trackId, key);
      restoredTrackIds.add(trackId);
    }
  }

  /** Whether this track's bytes come from the device store (vs. a fresh pick). */
  function isRestored(trackId: string): boolean {
    return restoredTrackIds.has(trackId);
  }

  /** Forget every binding (account switch). Saved records stay on disk for their owner. */
  function resetBindings(): void {
    keyByTrackId.clear();
    restoredTrackIds.clear();
  }

  return {
    currentUserKey,
    rememberAdded,
    rememberOrder,
    forget,
    rememberPlayed,
    loadSaved,
    bindRestored,
    isRestored,
    resetBindings,
  };
}
