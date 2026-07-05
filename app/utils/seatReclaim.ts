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
