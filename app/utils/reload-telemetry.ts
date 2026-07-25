// ========================================
// Reload cause telemetry
// ========================================
//
// The dominant reload path deliberately suppresses its own error reporting:
// `plugins/chunk-reload.client.ts` calls `event.preventDefault()` on
// `vite:preloadError` so Vite does not rethrow into Sentry as an unhandled
// exception. That suppression is correct — it is a handled, recovered fault —
// but until now it emitted *nothing* in its place, so nobody could tell how
// often reloads fire, or tell a deploy-driven chunk reload from a WebView
// renderer kill.
//
// This module is the deliberate signal that replaces the silence. It records
// three causes:
//
//  1. `chunk-preload`  — `vite:preloadError` / `app:chunkError`
//  2. `router-resolve` — the `$router.onError` stale-bundle branch
//  3. `no-js-cause`    — inferred, never recorded: the app booted, persisted
//                        state says the user was in a room seconds ago, and
//                        neither cause above left a marker. Nothing in the JS
//                        runtime survives a renderer kill to self-report, so
//                        absence-of-evidence IS the evidence.
//
// **The two storage tiers are load-bearing, not incidental.**
//  - The cause marker lives in `sessionStorage`: per-tab, survives a reload,
//    and dies with the tab. A leftover cannot leak into another tab's boot.
//  - The in-room snapshot lives in `localStorage`, because a renderer kill
//    recreates the WebView and takes `sessionStorage` with it. Cause 3 is
//    precisely the case where `sessionStorage` is gone, so the evidence for it
//    must not live there.
//
// **Honest limits of cause 3.** It conflates a WebView renderer kill, an OS
// app kill, and a hard crash — all three are "the JS runtime died without
// warning", which is why the cause is named for the absence of evidence rather
// than for a mechanism it cannot actually prove. `wasBackgrounded` is carried
// to help separate an OS reclaim of a backgrounded app from a renderer kill
// during active use. A user-initiated close is excluded a different way: it
// fires `pagehide`, which clears the snapshot.
// ========================================

import {
  IN_ROOM_SNAPSHOT_TTL_MS,
  RELOAD_CAUSE_TTL_MS,
  RELOAD_DETAIL_MAX_CHARS,
  SESSION_AGE_BUCKETS,
  SESSION_AGE_OVERFLOW_LABEL,
  SESSION_AGE_UNKNOWN_LABEL,
} from '~/constants/telemetry';

const RELOAD_CAUSE_KEY = 'reload-cause';
const IN_ROOM_SNAPSHOT_KEY = 'reload-in-room-snapshot';

/** Why the page reloaded. */
export type ReloadCause = 'chunk-preload' | 'router-resolve' | 'no-js-cause';

/** What the reload cost the user. */
export type ReloadOutcome = 'recovered' | 'ejected' | 'not-in-room' | 'unknown';

/** Causes that can record themselves before reloading. */
export type RecordableReloadCause = Exclude<ReloadCause, 'no-js-cause'>;

/** Written by the reloading code path immediately before it reloads. */
export interface ReloadCauseMarker {
  cause: RecordableReloadCause;
  detail: string;
  route: string;
  /** Exact age of the page session at the moment of the reload. */
  sessionAgeMs: number;
  at: number;
}

/** Written by the in-room heartbeat; the only evidence a renderer kill leaves. */
export interface InRoomSnapshot {
  roomId: number;
  seated: boolean;
  /** Whether the document was hidden at the last heartbeat. */
  hidden: boolean;
  /**
   * Whether the room was minimized. `minimizeRoom()` keeps `currentRoom` set,
   * so a minimized user is "in a room" while browsing somewhere else entirely —
   * and ticket 01's rehydration only covers cold mounts on `/room/:id`, so this
   * case cannot recover. Tagged separately to keep it out of the numerator when
   * grading 01's fix.
   */
  minimized: boolean;
  /** The route actually being viewed — NOT synthesised from the room id. */
  route: string;
  /** Epoch ms at which this page session began. */
  startedAt: number;
  /** Epoch ms of the last heartbeat. */
  at: number;
}

/** A resolved reload awaiting its outcome. */
export interface PendingReload {
  cause: ReloadCause;
  detail: string;
  route: string;
  inRoom: boolean;
  roomId: number | null;
  seated: boolean;
  minimized: boolean;
  wasBackgrounded: boolean;
  sessionAgeMs: number | null;
}

// ========================================
// Page session clock
// ========================================

/**
 * Age of the current page session. `performance.now()` is monotonic from page
 * origin, so unlike a wall-clock delta it cannot be corrupted by a clock step.
 */
export function pageSessionAgeMs(): number {
  if (typeof performance === 'undefined') return 0;
  return Math.round(performance.now());
}

/** Epoch ms at which the current page session began. */
export function pageSessionStartedAt(): number {
  return Date.now() - pageSessionAgeMs();
}

// ========================================
// Storage
// ========================================

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Storage unavailable (private mode, quota) or corrupt JSON. Losing a
    // telemetry record is always preferable to breaking a boot.
    return null;
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // As above — telemetry never gets to fail a user-facing path.
  }
}

function remove(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // As above.
  }
}

const sessionStore = (): Storage | undefined =>
  typeof sessionStorage === 'undefined' ? undefined : sessionStorage;

const localStore = (): Storage | undefined =>
  typeof localStorage === 'undefined' ? undefined : localStorage;

/** Record why the reload about to happen is happening. */
export function markReloadCause(
  cause: RecordableReloadCause,
  detail: string,
  route: string,
): void {
  const marker: ReloadCauseMarker = {
    cause,
    detail: detail.slice(0, RELOAD_DETAIL_MAX_CHARS),
    route,
    sessionAgeMs: pageSessionAgeMs(),
    at: Date.now(),
  };

  writeJson(sessionStore(), RELOAD_CAUSE_KEY, marker);
}

/** Refresh the evidence that this session is in a room right now. */
export function writeInRoomSnapshot(
  snapshot: Omit<InRoomSnapshot, 'at' | 'startedAt'>,
): void {
  writeJson(localStore(), IN_ROOM_SNAPSHOT_KEY, {
    ...snapshot,
    startedAt: pageSessionStartedAt(),
    at: Date.now(),
  } satisfies InRoomSnapshot);
}

/**
 * Drop the in-room evidence.
 *
 * Called on a genuine leave and on a genuine close. Without it, a user who
 * leaves a room and closes the app 30s later would boot into a false
 * `no-js-cause` record — the snapshot would still be inside its TTL.
 */
export function clearInRoomSnapshot(): void {
  remove(localStore(), IN_ROOM_SNAPSHOT_KEY);
}

// ========================================
// Resolution
// ========================================

/** Whether `at` is in the past and within `ttlMs` of `now`. */
function isFresh(at: number, now: number, ttlMs: number): boolean {
  const age = now - at;
  // The lower bound matters: a clock step backwards yields a negative age,
  // which would otherwise sail through a naive `age < ttl` check forever.
  return age >= 0 && age < ttlMs;
}

/**
 * Decide what — if anything — the previous page session's end should be
 * recorded as. Pure, so the whole truth table is unit-testable.
 *
 * A fresh explicit marker always wins: it names its own cause, so there is
 * nothing to infer. Cause 3 is only ever reached by elimination.
 */
export function resolvePendingReload(input: {
  marker: ReloadCauseMarker | null;
  snapshot: InRoomSnapshot | null;
  now: number;
}): PendingReload | null {
  const { marker, snapshot, now } = input;

  const freshMarker =
    marker && isFresh(marker.at, now, RELOAD_CAUSE_TTL_MS) ? marker : null;
  const freshSnapshot =
    snapshot && isFresh(snapshot.at, now, IN_ROOM_SNAPSHOT_TTL_MS) ? snapshot : null;

  if (freshMarker) {
    return {
      cause: freshMarker.cause,
      detail: freshMarker.detail,
      route: freshMarker.route,
      inRoom: freshSnapshot !== null,
      roomId: freshSnapshot?.roomId ?? null,
      seated: freshSnapshot?.seated ?? false,
      minimized: freshSnapshot?.minimized ?? false,
      wasBackgrounded: freshSnapshot?.hidden ?? false,
      // The marker's own reading is exact; the snapshot's is only accurate to
      // one heartbeat, so it is never preferred when the marker is present.
      sessionAgeMs: freshMarker.sessionAgeMs,
    };
  }

  if (freshSnapshot) {
    return {
      cause: 'no-js-cause',
      detail: '',
      route: freshSnapshot.route,
      inRoom: true,
      roomId: freshSnapshot.roomId,
      seated: freshSnapshot.seated,
      minimized: freshSnapshot.minimized,
      wasBackgrounded: freshSnapshot.hidden,
      sessionAgeMs: Math.max(0, freshSnapshot.at - freshSnapshot.startedAt),
    };
  }

  return null;
}

/**
 * Read and clear both markers, returning what should be reported.
 *
 * **Consumption is the point.** This must run before the in-room heartbeat can
 * overwrite the snapshot with the *new* session's state, and clearing is what
 * stops one reload being reported on every subsequent boot.
 */
export function consumePendingReload(now: number = Date.now()): PendingReload | null {
  const marker = readJson<ReloadCauseMarker>(sessionStore(), RELOAD_CAUSE_KEY);
  const snapshot = readJson<InRoomSnapshot>(localStore(), IN_ROOM_SNAPSHOT_KEY);

  remove(sessionStore(), RELOAD_CAUSE_KEY);
  clearInRoomSnapshot();

  return resolvePendingReload({ marker, snapshot, now });
}

// ========================================
// Tag shaping
// ========================================

/**
 * Bucket a session age for use as a Sentry tag. Raw milliseconds would give the
 * tag unbounded cardinality, which makes it useless for grouping.
 */
export function sessionAgeBucket(ageMs: number | null): string {
  if (ageMs === null || ageMs < 0) return SESSION_AGE_UNKNOWN_LABEL;

  return (
    SESSION_AGE_BUCKETS.find((bucket) => ageMs < bucket.maxMs)?.label ??
    SESSION_AGE_OVERFLOW_LABEL
  );
}

/** Path segments, query string and empty segments removed. */
function segmentsOf(path: string): string[] {
  return (path.split('?')[0] ?? '').split('/').filter(Boolean);
}

/**
 * Collapse a concrete path to its route pattern, so the tag stays low
 * cardinality. `/room/482` would otherwise mint a distinct tag value per room.
 * The concrete path still travels, in `extra`.
 */
export function routePatternOf(path: string): string {
  const segments = segmentsOf(path);
  if (segments.length === 0) return '/';
  if (segments[0] === 'room') return '/room/[id]';
  return `/${segments[0]}`;
}

/** Whether `path` addresses exactly `roomId` — not merely a room with that prefix. */
export function isRoomPath(path: string, roomId: number): boolean {
  const segments = segmentsOf(path);
  return segments[0] === 'room' && segments[1] === String(roomId);
}
