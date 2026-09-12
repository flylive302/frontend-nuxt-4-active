// ============================================
// Lucky Number (in-room tap-to-guess mini-game)
// ============================================
// THE single configuration area for the Lucky Number round on the client.
// Durations mirror MSAB config (LUCKY_NUMBER_* env) — MSAB is the authority
// for the round itself; these values only drive local rendering + gating.
// Units: ms unless stated.

export const LUCKY_NUMBER = {
  /** Round length — mirrors MSAB `LUCKY_NUMBER_ROUND_MS`. The real deadline is `endsAt` from the server. */
  roundDurationMs: 10_000,

  /** How long the drawn number stays over the Seat grid after `luckyNumber:result`. */
  revealDurationMs: 4_000,

  /** Owner/admin cannot start another round for this long after one ends — mirrors MSAB `LUCKY_NUMBER_COOLDOWN_MS`. */
  cooldownMs: 15_000,

  /** Minimum occupied Seats for a round — mirrors MSAB `LUCKY_NUMBER_MIN_SEATS`. */
  minSeats: 2,

  /** Countdown tick. The ONLY periodic work this game does, and only while a round is live. */
  countdownTickMs: 1_000,

  /** Pickable range — mirrors MSAB `LUCKY_NUMBER_MIN/MAX`. */
  min: 1,
  max: 9,

  /** Client-side tap coalescing: at most one `luckyNumber:pick` per window (mirrors MSAB ~1/300 ms). */
  pickThrottleMs: 300,

  /** How long the winner crown flashes on a Seat at reveal. */
  crownFlashMs: 1_500,

  /** lucky-number/03: how long after `endsAt` to wait for `luckyNumber:result` before treating the round as ended without a result (MSAB instance restart). */
  resultGraceMs: 3_000,
} as const;

/** Every pickable number, in strip order. */
export const LUCKY_NUMBER_CHOICES: readonly number[] = Array.from(
  { length: LUCKY_NUMBER.max - LUCKY_NUMBER.min + 1 },
  (_, i) => LUCKY_NUMBER.min + i,
);

/** Copy shown in the centre reveal when `winners` is empty. */
export const LUCKY_NUMBER_NO_WINNER_TEXT = 'No winner';
