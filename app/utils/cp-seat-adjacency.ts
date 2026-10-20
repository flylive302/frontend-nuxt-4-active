/**
 * CP seat adjacency — pure util (no Vue, no DOM).
 *
 * A CP heart shows between two partners seated in neighbouring seats of the
 * SAME grid row. The grid is 5 columns up to SEAT_GRID_WIDE_THRESHOLD seats,
 * 6 columns above it. The room page derives its Tailwind grid class from
 * `seatGridCols`, so this is the single source of the rule.
 */
import { SEAT_GRID_WIDE_THRESHOLD } from '~/constants/room'

const CP_SEAT_GRID_COLS = 5
const CP_SEAT_GRID_COLS_WIDE = 6

export interface CpSeatPairRef {
  readonly binder_id: number
  readonly partner_id: number
}

/** Seat indices (0-based), `left` + 1 === `right`, same row. */
export interface CpAdjacentSeats {
  readonly left: number
  readonly right: number
}

export function seatGridCols(seatCount: number): number {
  return seatCount > SEAT_GRID_WIDE_THRESHOLD ? CP_SEAT_GRID_COLS_WIDE : CP_SEAT_GRID_COLS
}

/**
 * @param seatUserIds seated user id per 0-based seat index (null = empty); its length is the seat count
 * @param pairs active pairs (any order of binder/partner)
 */
export function findAdjacentCpSeats(
  seatUserIds: readonly (number | null)[],
  pairs: readonly CpSeatPairRef[],
): CpAdjacentSeats[] {
  const cols = seatGridCols(seatUserIds.length)
  const seatByUser = new Map<number, number>()
  seatUserIds.forEach((userId, seat) => {
    if (userId !== null) seatByUser.set(userId, seat)
  })

  const seen = new Set<number>()
  const result: CpAdjacentSeats[] = []
  for (const pair of pairs) {
    const a = seatByUser.get(pair.binder_id)
    const b = seatByUser.get(pair.partner_id)
    if (a === undefined || b === undefined) continue
    const left = Math.min(a, b)
    const right = Math.max(a, b)
    if (right - left !== 1) continue
    if ((left + 1) % cols === 0) continue // left is the row's last seat: right wraps to the next row
    if (seen.has(left)) continue
    seen.add(left)
    result.push({ left, right })
  }
  return result
}
