/**
 * Seat retention (realtime-22) — pure decision for the FE re-claim path.
 *
 * When MSAB holds a speaker's seat through a reconnect grace window, the join
 * snapshot still lists them as an occupant even though their mic producer died
 * with the old socket. On rejoin we must re-establish audio so they return as a
 * speaker, not a silent seat. This predicate isolates that decision so it can be
 * unit-tested away from the socket/mediasoup integration in `useRoomAudio`.
 */

export interface SeatSnapshotEntry {
  seatIndex: number
  userId: number
  isMuted: boolean
}

/**
 * True when the authenticated user should re-produce their mic after a (re)join.
 *
 * - `false` on a fresh join: the user is never listed in their OWN join snapshot,
 *   so an empty/absent seat match means nothing to reclaim.
 * - `false` when already producing: guards a benign rejoin (e.g. un-minimize)
 *   from starting a second producer.
 * - `true` only when the snapshot shows us seated AND we are not yet producing —
 *   the seat-retention reclaim case.
 */
export function shouldReproduceOnReclaim(
  seats: SeatSnapshotEntry[] | undefined,
  userId: number | undefined,
  isProducing: boolean,
): boolean {
  if (userId === undefined || isProducing) return false
  return (seats ?? []).some((seat) => seat.userId === userId)
}

// ============================================================
// mic-fgs-crash 02 — visibility-gated re-claim
// ============================================================
//
// `shouldReproduceOnReclaim` above answers "is a re-claim owed at all". It says
// nothing about WHEN, and the re-claim path runs from a socket callback — so it
// fired while the app was backgrounded. Re-opening the mic there starts a
// `microphone`-typed foreground service from the background, which fails
// Android's while-in-use check and kills the process (the F6 crash cluster).
//
// The two functions below split that single answer into "now or later":
//
//   join snapshot ──▶ decideSeatReclaim ──┬─▶ 'reproduce'  open the mic now
//                                         ├─▶ 'defer'      owe one, record it
//                                         └─▶ 'none'       nothing owed
//
//   hidden→visible ─▶ decidePendingDrain ─┬─▶ 'reproduce'  settle the debt
//                                         ├─▶ 'seat-lost'  tell the user
//                                         └─▶ 'none'       nothing to settle
//
// ⛔ The gate is on the RE-PRODUCE, never on the foreground service (spec D1).
// Suppressing only the service while the mic goes live is strictly worse than
// the crash: Android revokes capture on background and the Speaker is silently
// muted while the UI, the server and every other participant still show them
// live. Mic state and foreground-service state stay derived from one another.
//
// Both are pure — no Vue, no Nuxt, no Capacitor. Visibility is passed IN as a
// plain boolean rather than read here, which keeps them runnable in the suite's
// DOM-less environment and keeps one source of truth for visibility (spec D2).

/** What a (re)join should do about the user's retained Seat. */
export type SeatReclaimAction = 'reproduce' | 'defer' | 'none'

/** What a resume should do about a re-claim that was deferred earlier. */
export type PendingDrainAction = 'reproduce' | 'seat-lost' | 'none'

export interface SeatReclaimInput {
  /** Seats from the join snapshot. */
  seats: SeatSnapshotEntry[] | undefined
  /** Authenticated user id, or `undefined` when signed out. */
  userId: number | undefined
  /** LIVE mediasoup producing state — not the store flag, which goes stale-true. */
  isProducing: boolean
  /** Whether the app is on screen right now, read at decision time. */
  isVisible: boolean
}

/**
 * Decide what a (re)join should do about a retained Seat.
 *
 * Composes on top of `shouldReproduceOnReclaim` rather than replacing it, so
 * that predicate and its tests stay exactly as they were.
 *
 * `'defer'` costs a SILENT Seat, not a lost one: MSAB clears the retention
 * timestamp on the re-join itself, with no producer or mic term anywhere in the
 * reclaim script or the expiry sweep (spec D6, verified in the server source).
 * The user therefore keeps their position for as long as they stay connected,
 * however long the app stays backgrounded.
 *
 * Users in a cross-region edge Room never reach `'defer'`: those Rooms reserve
 * no Seats at all, so the join snapshot never lists them and this returns
 * `'none'` — they cannot acquire a pending re-claim.
 */
export function decideSeatReclaim(input: SeatReclaimInput): SeatReclaimAction {
  if (!shouldReproduceOnReclaim(input.seats, input.userId, input.isProducing)) {
    return 'none'
  }
  return input.isVisible ? 'reproduce' : 'defer'
}

export interface PendingDrainInput {
  /** Whether a re-claim was deferred earlier and is still owed. */
  pending: boolean
  /** Whether the user still occupies a Seat right now. */
  seatedNow: boolean
  /** LIVE mediasoup producing state. */
  isProducing: boolean
}

/**
 * Decide what a resume owes a re-claim that was deferred while hidden.
 *
 * `'seat-lost'` is the RARE branch, not the main path (spec D6). It cannot be
 * reached by the retention window expiring: if the reconnect outruns the grace
 * window the Seat is already swept, so the user is absent from the join
 * snapshot, so `decideSeatReclaim` returns `'none'` and nothing is ever
 * deferred. A pending re-claim can only exist AFTER a successful reclaim, so
 * losing the Seat afterwards needs a genuinely separate event — a moderator
 * clearing it, or a second disconnect.
 *
 * Already producing wins over both: the session healed by some other route
 * (a rebuild, a manual retake) and there is no debt left to settle.
 */
export function decidePendingDrain(input: PendingDrainInput): PendingDrainAction {
  if (!input.pending) return 'none'
  if (input.isProducing) return 'none'
  if (!input.seatedNow) return 'seat-lost'
  return 'reproduce'
}
