/**
 * Seat Picker Options Composable
 *
 * Derives the progression-aware seat-count picker options for the room
 * settings drawer (room-seat-caps PRD, slice 05). Pure derivation lives here
 * so the settings-drawer component stays INTENT-only (template + display).
 */
import { MIN_SEAT_COUNT, MAX_SEAT_COUNT, SEAT_COUNT_STEP, DEFAULT_SEAT_COUNT } from '~/constants/room'
import type { SeatLadderLevel } from '~/types/user/bootstrap'

// ========================================
// Types
// ========================================

export interface SeatPickerOption {
  label: string
  value: number
  disabled: boolean
  /** "Unlocks at room level N" — present only when locked AND the ladder covers this tier. */
  unlockLabel?: string
}

// ========================================
// Pure Helper (unit-testable without Nuxt runtime)
// ========================================

/**
 * Lowest ladder level whose cap covers `value` (i.e. the level a room must
 * reach to unlock this tier). Returns null when no ladder entry covers it
 * (e.g. an empty ladder) — callers render the tier locked with no sublabel.
 */
export function resolveUnlockLevel(value: number, seatLadder: SeatLadderLevel[]): number | null {
  const covering = seatLadder
    .filter((step) => step.cap >= value)
    .sort((a, b) => a.level - b.level)
  return covering[0]?.level ?? null
}

/**
 * Build the full 5..30 (step 5) seat option list, marking tiers above
 * `seatCap` as disabled with a ladder-derived "Unlocks at room level N" label.
 */
export function buildSeatPickerOptions(seatCap: number, seatLadder: SeatLadderLevel[]): SeatPickerOption[] {
  const options: SeatPickerOption[] = []
  for (let n = MIN_SEAT_COUNT; n <= MAX_SEAT_COUNT; n += SEAT_COUNT_STEP) {
    const disabled = n > seatCap
    const unlockLevel = disabled ? resolveUnlockLevel(n, seatLadder) : null
    options.push({
      label: `${n} seats`,
      value: n,
      disabled,
      ...(unlockLevel !== null ? { unlockLabel: `Unlocks at room level ${unlockLevel}` } : {}),
    })
  }
  return options
}

// ========================================
// Composable
// ========================================

/**
 * Reactive seat picker options bound to the given room's live `seat_cap` /
 * `seat_ladder`. Recomputes off store state (no snapshot), so a cap bump
 * (room level-up) is reflected next time the caller reads `.value` — e.g. on
 * drawer open.
 */
export function useSeatPickerOptions(room: Ref<{ seat_cap?: number; seat_ladder?: SeatLadderLevel[] } | null | undefined>) {
  const seatOptions = computed<SeatPickerOption[]>(() =>
    // Fail closed: a payload without seat_cap gets the base cap, not full unlock.
    buildSeatPickerOptions(room.value?.seat_cap ?? DEFAULT_SEAT_COUNT, room.value?.seat_ladder ?? []),
  )

  return { seatOptions }
}
